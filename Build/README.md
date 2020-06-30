# The Perception Build System

Operating systems are complicated, C++ build systems and library management are messy, and cross compiling to another OS is fun, so we have a custom build system.

The build system's source lives in source/ and is written in Javascript for Node.js.

## Features
- Supports .c (C), .cc/.cpp (C++), .s/.S (AT&T assembly syntax), .asm (Intel assembly syntax).
- Builds all source files in a package's source/ subdirectory. No need to keep a list of files to build.
- Only rebuilds a file if it or a one of its dependencies have changed.
- Supports recursive dependencies between libraries. (This really wasn't that difficult since header files don't need to get built to include them, so I wonder why more build systems don't support this.)
- One command to build the universe, package it together into a bootable ISO file, and start QEMU.
- Coming soon: importing and updating external packages via git.

## Usage
See [../building.md](../building.md) to get started building Perception.

Commands: (Replace ./build with build.bat on Windows.)

- `./build` - Builds everything. The kernel, all applications, and creates a Perception.iso in the root directory.
- `./build run` - Builds everything and starts QEMU.
- `./build kernel` - Builds the kernel.
- `./build application <application>` - Builds a particular application.
- `./build library <library>` - Builds a particular library.
- `./build clean` - Cleans up built files.

## Package directory hierarchy
There are 3 types of packages - the kernel, libraries, and applications. The kernel lives in `Kernel`, libraries live within their own directories in `Libraries`, and applications live within their own directories in `Applications`.

The layout of a package's directory is:

- `public` - For libraries, files in here will be #include'able by packages that depend on the library.
- `source` - Where the source code lives. Any code that lives in here will be built.
- `metadata.json` - The metadata that controls how this package will be built.

The generated files/directories inside of a package's directory are:

- `build` - Files generated by the compiler during building go here, before getting linked together.
- `third_party` - Files downloaded from an external repository go here.
- `application.app`/`library.lib`/`kernel.app` - The built binary.
- `dependencies.json` - An generated collection of source files and their dependencies, used for determining when to recompile a file.

You do not have to provide the generated files/directories, and please don't check them into git. They will be created if they don't exist.

## metadata.json
Each package's directory contains a metadata.json that controls how that package gets built. Unused fields can be emitted.

- `dependencies` - Libraries this package depends on.
- `include` - Additional directories within this package, who's files will be #include'able by the package's own source files.
- `public_include` - Directories within this package that are #includeable by packages that depend on this library (and also by the package's own source files). If this is omitted, it is assumed to have one entry, which is `public`.
- `define` - Preprocessor symbols to define while building this package's own source files.
- `public_define` - Preprocessor symbols to define while building this package's own source files and all packages that depend on this library.
- `third_party` - TODO