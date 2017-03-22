#!/usr/bin/env node

import * as llvm from "llvm-node";
import * as ts from "typescript";
import * as program from "commander";

const packageJson = require("./package.json");
import {reportDiagnostics} from "./src/util/diagnostics";
import {Compiler} from "./src/compiler";
import {IExportedCommand} from "commander";
import {SpeedyJSCompilerOptions} from "./src/speedyjs-compiler-options";



llvm.initializeAllTargets();
llvm.initializeAllTargetInfos();
llvm.initializeAllAsmPrinters();
llvm.initializeAllTargetMCs();
llvm.initializeAllAsmParsers();

interface CommandLineArguments extends IExportedCommand {
    files: string[],
    config?: string,
    unsafe?: boolean;
    emitLLVM?: boolean;
    binaryenOpt?: boolean;
}

function parseCommandLine(): CommandLineArguments {
    program
        .version(packageJson.version)
        .usage("[options] [files ...]")
        .option("-c --config <configFile>", "The path to the tsconfig.json")
        .option("--unsafe", "Use the unsafe runtime system")
        .option("--emit-llvm", "Emit LLVM Assembly Code instead of WASM files")
        .option("--binaryen-opt", "Optimize using Binaryen opt")
        .parse(process.argv);

    return program as CommandLineArguments;
}

function parseConfigFile(configFileName: string): ts.ParsedCommandLine {
    const configurationFileText = ts.sys.readFile(configFileName);
    const jsonConfig = ts.parseConfigFileTextToJson(configFileName, configurationFileText);
    if (jsonConfig.error) {
        reportDiagnostics([jsonConfig.error]);
        ts.sys.exit(ts.ExitStatus.DiagnosticsPresent_OutputsSkipped);
    }

    const parsedConfiguration = ts.parseJsonConfigFileContent(jsonConfig.config, ts.sys, ".", undefined, configFileName);
    if (parsedConfiguration.errors.length > 0) {
        reportDiagnostics(parsedConfiguration.errors);
        ts.sys.exit(ts.ExitStatus.DiagnosticsPresent_OutputsSkipped);
    }

    return parsedConfiguration;
}

function getCompilerOptions(commandLine: CommandLineArguments, tsConfigFileName: string) {
    let rootFileNames: string[] = [];
    let compilerOptions: SpeedyJSCompilerOptions;

    if (tsConfigFileName) {
        const configuration = parseConfigFile(tsConfigFileName);
        rootFileNames = configuration.fileNames;
        compilerOptions = configuration.options;
    } else {
        rootFileNames = commandLine.files;
        compilerOptions = ts.getDefaultCompilerOptions();
    }

    compilerOptions.unsafe = commandLine.unsafe;
    compilerOptions.binaryenOpt = commandLine.binaryenOpt;
    compilerOptions.emitLLVM = commandLine.emitLLVM;

    return { rootFileNames, compilerOptions };
}

function run() {
    const commandLine = parseCommandLine();

    const configFileName = commandLine.config || ts.findConfigFile(ts.sys.getCurrentDirectory(), ts.sys.fileExists);

    if (commandLine.args.length === 0 && !configFileName) {
        ts.sys.write("Pass either a config file or the files to use");
        commandLine.outputHelp();
        ts.sys.exit(ts.ExitStatus.DiagnosticsPresent_OutputsSkipped);
    }


    const { compilerOptions, rootFileNames } = getCompilerOptions(commandLine, configFileName);
    const compilerHost = ts.createCompilerHost(compilerOptions);
    const compiler = new Compiler(compilerOptions, compilerHost);

    const { diagnostics, exitStatus } = compiler.compile(rootFileNames);
    if (diagnostics.length > 0) {
        reportDiagnostics(diagnostics);
    }

    return ts.sys.exit(exitStatus);
}

run();