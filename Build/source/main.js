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

const process = require('process');
const {build} = require('./build');
const {buildImage} = require('./build_image');
const {clean} = require('./clean');
const {run} = require('./run');
const {PackageType} = require('./package_type');

// Parses the input.
switch (process.argv[2]) {
	case 'application':
		build(PackageType.APPLICATION, process.argv[3]).then((res) => {
			console.log(res ? "done!" : "failed!");
		}, (err) =>{
			console.log(err);
		});
		break;
	case 'library':
		build(PackageType.LIBRARY, process.argv[3]).then((res) => {
			console.log(res ? "done!" : "failed!");
		}, (err) =>{
			console.log(err);
		});
		break;
	case 'kernel':
		build(PackageType.KERNEL, '').then((res) => {
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
	case 'all':
		buildImage();
		break;
	case 'help':
	case undefined:
		break;
	default:
		console.log('Don\'t know what to compile. Argument was ' + process.argv[2]);
		break;
}