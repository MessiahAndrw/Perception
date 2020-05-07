// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const fs = require('fs');
const child_process = require('child_process');
const process = require('process');

// Relative path to root directory.
const rootDirectory = '../';

// Pseudo-enum for compile result status.
const FAILED = 0;
const ALREADY_BUILT = 1;
const COMPILED = 2;

// Pseudo-enum for type of package we are compiling.
const APPLICATION = 0;
const LIBRARY = 1;
const KERNEL = 2;

// Loads the config file that contains the tools to use on this system.
if (!fs.existsSync('tools.json')) {
	console.log('tools.json does not exist. Please read ../building.md.');
	process.exit(1);

}
const TOOLS = JSON.parse(fs.readFileSync('tools.json'));

// Commands for building.
const ASM_COMMAND = 'nasm -felf64';
const CC_KERNEL_COMMAND = TOOLS['gcc'] + ' -m64 -mcmodel=kernel ' +
	'-ffreestanding -fno-builtin -nostdlib -nostdinc -mno-red-zone  -c ' +
	'-msoft-float -mno-mmx -mno-sse -mno-sse2 -mno-3dnow -mno-avx ' +
	'-mno-avx2 -MD -MF temp.d  -isystem ' + rootDirectory + 'Kernel/source ';
const CC_COMMAND = TOOLS['gcc'] + ' -O3 -m64 -ffreestanding -nostdlib ' +
	'-nostdinc++ -mno-red-zone -c -MD -MF temp.d ';
const KERNEL_LINKER_COMMAND = TOOLS['ld'] + ' -nodefaultlibs -T ' + rootDirectory + 'Kernel/source/linker.ld -Map=map.txt ';
const LIBRARY_LINKER_COMMAND = TOOLS['ld'] + ' -nodefaultlibs -relocatable ';
const APPLICATION_LINKER_COMMAND = TOOLS['ld'] + ' -nodefaultlibs ' +
	'-T userland.ld -Map=map.txt  ';
const GRUB_MKRESCUE_COMMAND = TOOLS['grub-mkrescue'] + ' -o ' + rootDirectory +
	 'Perception.iso' + ' ' + rootDirectory + 'fs';
const EMULATOR_COMMAND = TOOLS['qemu'] + ' -boot d -cdrom ' + rootDirectory +
	'Perception.iso -m 512 -serial stdio';

// Calls 'foreachFunc' for each file in the package directory.
async function foreachSourceFile (packageDir, foreachFunc) {
	await foreachSourceFileInSourceDir(
			slashEndingPath(packageDir + 'source'),
			slashEndingPath(packageDir + 'build'),
			foreachFunc);
}

// Calls 'foreachFunc' for each file in the source directory.
async function foreachSourceFileInSourceDir (dir, buildDir, foreachFunc) {
	if (!fs.existsSync(buildDir)) {
		fs.mkdirSync(buildDir);
	}

	let files = fs.readdirSync(dir);

	for (let i = 0; i < files.length; i++) {
		const fullPath = dir + files[i];
		const buildPath = buildDir + files[i];
		const fileStats = fs.lstatSync(fullPath);
		if (fileStats.isDirectory()) {
			await foreachSourceFileInSourceDir(fullPath + '/', buildPath + '/', foreachFunc)
		} else if (fileStats.isFile()) {
				await foreachFunc(fullPath, buildPath);
		}
	}
}

// Returns a path that ends in a slash.
function slashEndingPath(path) {
	return path.endsWith('/') ? path : path + '/';
}

// Returns a path that doesn't end in a slash.
function stripLastSlash(path) {
	return path.endsWith('/') ? path.substring(0, path.length - 1) : path;
}

// Gets the directory for a package type and package name.
function getPackageDirectory(packageType, packageName) {
	switch (packageType) {
		case APPLICATION:
		return rootDirectory + 'Applications/' + packageName + '/';
		case LIBRARY:
		return rootDirectory + 'Libraries/' + packageName + '/';
		case KERNEL:
		return rootDirectory + 'Kernel/';
		default:
			return '';
	}
}

// Gets the build command to use for a file.
function getBuildCommand(filePath, packageType, ccCompileCommand) {
	if (filePath.endsWith('.cc') || filePath.endsWith('.c'))
		return packageType == KERNEL ? CC_KERNEL_COMMAND : ccCompileCommand;
	else if (filePath.endsWith('.asm'))
		return ASM_COMMAND;
	else if (filePath.endsWith('.h') || filePath.endsWith('.inl') || filePath.endsWith('.ld') || filePath.endsWith('.txt')
		|| filePath.endsWith('.DS_Store'))
		return '';
	else {
		console.log('Don\'t know how to build ' + filePath);
		return '';
	}
}

// Compiles a package.
async function compile(packageType, packageName, librariesToLink, parentPublicIncludeDirs) {
	if (librariesToLink == undefined) {
		librariesToLink = [];
	}
	if (parentPublicIncludeDirs == undefined) {
		parentPublicIncludeDirs = [];
	}

	const packageDirectory = getPackageDirectory(packageType, packageName);

	if (!fs.existsSync(packageDirectory + 'metadata.json')) {
		fs.writeFileSync(packageDirectory + 'metadata.json', JSON.stringify({ dependencies: [] }));
	}
	const metadata = JSON.parse(fs.readFileSync(packageDirectory + 'metadata.json'));
	let forceRelinkIfApplication = false;

	const publicIncludeDirs = [];

	if (packageType != KERNEL) {
		// The kernel can't depend on anything other than itself.
		for (let i = 0; i < metadata.dependencies.length; i++) {
			const dependency = metadata.dependencies[i];
			// console.log('Depends on ' + dependency);
			const success = await compile(LIBRARY, dependency, librariesToLink, publicIncludeDirs);
			if (!success) {
				console.log('Dependency ' + dependency + ' failed to build.');
				return FAILED;
			} else if (success == COMPILED) {
				// The dependency rebuilt so if we are an application we must relink.
				forceRelinkIfApplication = true;
			}
		}
	}

	const depsFile = packageDirectory + 'dependencies.json';
	let dependenciesPerFile = fs.existsSync(depsFile) ? JSON.parse(fs.readFileSync(depsFile)) : {};

	let lastModifiedTimestampByFile = {};
	function getFileLastModifiedTimestamp(file) {
		const cached = lastModifiedTimestampByFile[file];
		if (cached != undefined) {
			return cached;
		}

		const timestamp = fs.existsSync(file) ? fs.lstatSync(file).mtimeMs : Number.MAX_VALUE;
		lastModifiedTimestampByFile[file] = timestamp;
		return timestamp;
	}

	let ccBuildCommand = CC_COMMAND; // 'emcc -s DISABLE_EXCEPTION_CATCHING=0 -s DEMANGLE_SUPPORT=1 --bind -s LINKABLE=1 -s BINARYEN=1 -MD -MF temp.d -std=c++17';

    ccBuildCommand += ' -isystem '+ packageDirectory + 'public';

	// Public dirs exported by each of our dependencies.
	publicIncludeDirs.forEach((includeDir) => {
		ccBuildCommand += ' -isystem ' + includeDir;
	});

	parentPublicIncludeDirs.push(packageDirectory + 'public');

	let objectFiles = [];
	let errors = false;
	let anythingChanged = false;

    await foreachSourceFile(packageDirectory,
		async function (file, buildPath) {
			const buildCommand = getBuildCommand(file, packageType, ccBuildCommand);
			if (buildCommand == '') {
				// Skip this file.
				return;
			}

			let shouldCompileFile = false;
			const objectFile = buildPath + /*sourceFileToObjectFile(packageDirectory, file) + */ '.obj';
			objectFiles.push(objectFile);

			if (!fs.existsSync(objectFile)) {
				// Compile if the output file doesn't exist.
				shouldCompileFile = true;
			} else {
				const objectFileTimestamp = fs.lstatSync(objectFile).mtimeMs;

				const deps = dependenciesPerFile[file];
				if (deps == null) {
					// Compile because we don't know the dependencies.
					shouldCompileFile = true;
				} else {
					for (let i = 0; i < deps.length; i++) {
						if (getFileLastModifiedTimestamp(deps[i]) >= objectFileTimestamp) {
							// Compile because one of the dependencies is newer.
							shouldCompileFile = true;
							break;
						}
					}
				}
			}

			if (shouldCompileFile) {
				anythingChanged = true;
				console.log("Compiling " + file);
				const command = buildCommand + ' -o ' + objectFile + ' ' + file;
				// console.log(" with command: " + command);
				var compiled = false;
				try {
					child_process.execSync(command);
					compiled = true;
				} catch (exp) {
					errors = true;
				}

				if (!compiled) { return; }

				// Update "dependencies".
				if (file.endsWith('.asm')) {
					// Assembly files don't include anything other than themselves.
					dependenciesPerFile[file] = [file];
				} else {
					let depsStr = fs.readFileSync('temp.d').toString('utf8');
					let separator = depsStr.indexOf(':');
					if (separator == -1) {
						throw "Error parsing dependencies: " + deps;
					}
					let newDeps = [];
					depsStr.substring(separator + 1).split("\\\n").forEach(s1 => {
						s1.split(' ').forEach(s2 => {
							s2 = s2.trim();
							if (s2.length > 1) {
								newDeps.push(s2);
							}
						});
					});
					dependenciesPerFile[file] = newDeps;
				}
			}
		});
    if (anythingChanged) {
		fs.writeFileSync(depsFile, JSON.stringify(dependenciesPerFile));
	}

	if (errors) {
		console.log('There were errors compiling.');
		return FAILED;
	} else if (objectFiles.length == 0) {
		console.log('Nothing was compiled.');
		return FAILED;
	} else if (packageType == LIBRARY) {
		librariesToLink.push(packageDirectory + 'library.lib');
		if (!anythingChanged && fs.existsSync(packageDirectory + 'library.lib')) {
			return forceRelinkIfApplication ? COMPILED : ALREADY_BUILT;
		}
		if (fs.existsSync(packageDirectory + 'library.lib')) {
			fs.unlinkSync(packageDirectory + 'library.lib');
		}

		console.log("Building library " + packageName);
		const command = LIBRARY_LINKER_COMMAND + ' -o ' + packageDirectory + 'library.lib' + ' ' + objectFiles.join(' ');
		// console.log(command);
		try {
			child_process.execSync(command);
			compiled = true;
		} catch (exp) {
			return false;
		}

		return COMPILED;
	} else if (packageType == APPLICATION) {
		if (!anythingChanged && fs.existsSync(packageDirectory + 'application.app')
			&& !forceRelinkIfApplication) {
			return ALREADY_BUILT;
		}
		if (fs.existsSync(packageDirectory + 'application.app')) {
			fs.unlinkSync(packageDirectory + 'application.app');
		}
		console.log("Building application " + packageName);
		let command = APPLICATION_LINKER_COMMAND + ' -o ' + packageDirectory + 'application.app' + ' ' + objectFiles.join(' ');
		librariesToLink.forEach((libraryToLink) => {
			command += ' ' + librariesToLink;
		});
		try {
			child_process.execSync(command);
			compiled = true;
		} catch (exp) {
			return FAILED;
		}

		return COMPILED;
	} else if (packageType == KERNEL) {
		if (!anythingChanged && fs.existsSync(packageDirectory + 'kernel.app')) {
			return ALREADY_BUILT;
		}
		if (fs.existsSync(packageDirectory + 'kernel.app')) {
			fs.unlinkSync(packageDirectory + 'kernel.app');
		}

		let command = KERNEL_LINKER_COMMAND + ' -o ' + packageDirectory + 'kernel.app' + ' ' + objectFiles.join(' ');
		librariesToLink.forEach((libraryToLink) => {
			command += ' ' + librariesToLink;
		});
		try {
			child_process.execSync(command);
			compiled = true;
		} catch (exp) {
			return FAILED;
		}

		return COMPILED;
	} else {
		console.log('Unknown project type.')
		return FAILED;
	}
};

function copyIfNewer(source, destination) {
	if (fs.existsSync(destination)) {
		// Don't copy if the source older or same age as the destination.
		if (fs.lstatSync(source).mtimeMs <= fs.lstatSync(destination).mtimeMs)
			return false;

		fs.unlinkSync(destination);
	}

	console.log('Copying ' + destination);
	fs.copyFileSync(source, destination);
	return true;
}

// Builds everything.
async function buildEverything() {
	let somethingChanged = false;

	let success = await compile(KERNEL, '');
	if (!success) {
		console.log('Compile error. Stopping the world.');
		return FAILED;
	}

	somethingChanged |= copyIfNewer(rootDirectory + 'Kernel/kernel.app', rootDirectory + 'fs/boot/kernel.app');

	// Compile and copy all applications
	let applications = fs.readdirSync(rootDirectory + 'Applications/');
	for (let i = 0; i < applications.length; i++) {
		const applicationName = applications[i];
		const fullPath = rootDirectory + 'Applications/' + applicationName;
		const fileStats = fs.lstatSync(fullPath);
		if (fileStats.isDirectory()) {
			success = await compile(APPLICATION, applicationName);
			if (!success) {
				console.log('Compile error. Stopping the world.');
				return FAILED;
			}

			somethingChanged |= copyIfNewer(
				rootDirectory + 'Applications/' + applicationName + '/application.app',
				rootDirectory + 'fs/' + applicationName + '.app');
		}
	}

	if (somethingChanged || !fs.existsSync(rootDirectory + 'Perception.iso')) {
		let command = GRUB_MKRESCUE_COMMAND;
		try {
			child_process.execSync(command);
		} catch (exp) {
			return FAILED;
		}
	}

	return COMPILED;
}

// Builds everything and runs the emulator.
async function run() {
	const success = await buildEverything();
	if (success) {
		console.log(EMULATOR_COMMAND);
		child_process.execSync(EMULATOR_COMMAND, {stdio: 'inherit'});
	}
}

// Tries to delete a file or directory, if it exists.
function maybeDelete(path) {
	if (!fs.existsSync(path)) {
		return;
	}
	const fileStats = fs.lstatSync(path);
	console.log('Removing ' + path);
	if (fileStats.isDirectory()) {
		fs.rmdirSync(path, { recursive: true });
	} else {
		fs.unlinkSync(path);
	}
}

// Removes all built files.
function clean() {
	// Clean up kernel.
	maybeDelete(rootDirectory + 'Kernel/build');
	maybeDelete(rootDirectory + 'Kernel/kernel.app');
	maybeDelete(rootDirectory + 'Kernel/dependencies.json');
	maybeDelete(rootDirectory + 'fs/boot/kernel.app');

	// Clean up libraries.
	let libraries = fs.readdirSync(rootDirectory + 'Libraries/');
	for (let i = 0; i < libraries.length; i++) {
		const libraryName = libraries[i];
		const fullPath = rootDirectory + 'Libraries/' + libraryName;
		const fileStats = fs.lstatSync(fullPath);
		if (fileStats.isDirectory()) {
			maybeDelete(fullPath + '/build');
			maybeDelete(fullPath + '/dependencies.json');
			maybeDelete(fullPath + '/library.lib');
		}
	}

	// Clean up applications.
	let applications = fs.readdirSync(rootDirectory + 'Applications/');
	for (let i = 0; i < applications.length; i++) {
		const applicationName = applications[i];
		const fullPath = rootDirectory + 'Applications/' + applicationName;
		const fileStats = fs.lstatSync(fullPath);
		if (fileStats.isDirectory()) {
			maybeDelete(fullPath + '/build');
			maybeDelete(fullPath + '/dependencies.json');
			maybeDelete(fullPath + '/application.app');
			maybeDelete(rootDirectory + 'fs/' + applicationName + '.app');
		}
	}

	// Clean up ISO image.
	maybeDelete(rootDirectory + 'Perception.iso');
}

// Parses the input.
switch (process.argv[2]) {
	case 'application':
		compile(APPLICATION, process.argv[3]).then((res) => {
			console.log(res ? "done!" : "failed!");
		}, (err) =>{
			console.log(err);
		});
		break;
	case 'library':
		compile(LIBRARY, process.argv[3]).then((res) => {
			console.log(res ? "done!" : "failed!");
		}, (err) =>{
			console.log(err);
		});
		break;
	case 'kernel':
		compile(KERNEL, '').then((res) => {
			console.log(res ? "done!" : "failed!");
		}, (err) =>{
			console.log(err);
		});
		break;
	case 'run':
		run();
		break;
	case 'clean':
		clean();
		break;
	case undefined:
		buildEverything();
		break;
	default:
		console.log('Don\'t know what to compile. Argument was ' + process.argv[2]);
		break;
}