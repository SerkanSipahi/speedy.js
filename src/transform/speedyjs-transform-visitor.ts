import * as ts from "typescript";
import debug = require("debug");
import {TransformVisitor, TransformVisitorContext} from "./transform-visitor";
import {CodeGenerator} from "../code-generation/code-generator";

const log = debug("visitor");

export class SpeedyJSTransformVisitor implements TransformVisitor {
    private inSpeedyJSFunction = false;

    constructor(private program: ts.Program, private llvmEmitter: CodeGenerator) {}

    visitFunctionDeclaration(functionDeclaration: ts.FunctionDeclaration, context: TransformVisitorContext) {
        if (isSpeedyJSFunction(functionDeclaration)) {
            const name = getName(functionDeclaration, this.program.getTypeChecker());
            log(`Enable SpeedyJS for ${name}`);

            this.inSpeedyJSFunction = true;

            try {
                this.llvmEmitter.generate(functionDeclaration, this.program);
                // replace function with wasm include
                return functionDeclaration;
            } finally {
                log(`Disable SpeedyJS for ${name}`);
                this.inSpeedyJSFunction = false;
            }
        } else {
            return context.visitEachChild(functionDeclaration);
        }
    }

    fallback<T extends ts.Node>(node: T, context: TransformVisitorContext): T {
        // TODO change to throw
        log(`Node of kind ${ts.SyntaxKind[node.kind]} is not (yet) supported by SpeedyJS.`);
        context.visitEachChild(node);
        return node;
    }
}

function isSpeedyJSFunction(fun: ts.FunctionLikeDeclaration) {
    if (!fun.body || !isBlock(fun.body)) {
        return false;
    }

    for (const statement of fun.body.statements) {
        if (isPrologueDirective(statement)) {
            if (statement.expression.text === "use speedyjs") {
                return true;
            }
        } else {
            break;
        }
    }
    return false;
}

function getName(functionDeclaration: ts.FunctionDeclaration, typeChecker: ts.TypeChecker) {
    if (!functionDeclaration.name) {
        return "**anonymous**";
    }

    const symbol = typeChecker.getSymbolAtLocation(functionDeclaration.name);
    return typeChecker.getFullyQualifiedName(symbol);
}

interface PrologueDirective extends ts.ExpressionStatement {
    expression: ts.StringLiteral;
}

function isPrologueDirective(node: ts.Node): node is PrologueDirective {
    return node.kind === ts.SyntaxKind.ExpressionStatement && (node as ts.ExpressionStatement).expression.kind === ts.SyntaxKind.StringLiteral;
}

function isBlock(node: ts.Node): node is ts.Block {
    return node.kind === ts.SyntaxKind.Block;
}
