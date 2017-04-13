import * as ts from "typescript";
import {TypeChecker} from "./type-checker";

/**
 * Wrapper of the type script type checker.
 * It mainly gets rid of all nullable types. If nullable types are supported, than the unwrapping
 * of nullable types should be removed.
 */
export class TypeScriptTypeChecker implements TypeChecker {
    constructor(private tsTypeChecker: ts.TypeChecker) {}

    getAliasedSymbol(symbol: ts.Symbol): ts.Symbol {
        return this.tsTypeChecker.getAliasedSymbol(symbol);
    }

    getApparentType(type: ts.Type): ts.Type {
        return this.toSupportedType(this.tsTypeChecker.getApparentType(type));
    }

    getSignaturesOfType(type: ts.Type, kind: ts.SignatureKind): ts.Signature[] {
        return this.tsTypeChecker.getSignaturesOfType(type, kind);
    }

    getReturnTypeOfSignature(signature: ts.Signature): ts.Type {
        return this.toSupportedType(this.tsTypeChecker.getReturnTypeOfSignature(signature));
    }

    getDeclaredTypeOfSymbol(symbol: ts.Symbol): ts.Type {
        return this.toSupportedType(this.tsTypeChecker.getDeclaredTypeOfSymbol(symbol));
    }

    getSymbolAtLocation(node: ts.Node): ts.Symbol {
        return this.tsTypeChecker.getSymbolAtLocation(node);
    }

    getFullyQualifiedName(symbol: ts.Symbol): string {
        return this.tsTypeChecker.getFullyQualifiedName(symbol);
    }

    getSignatureFromDeclaration(functionDeclaration: ts.FunctionDeclaration): ts.Signature {
        return new SignatureWrapper(this.tsTypeChecker.getSignatureFromDeclaration(functionDeclaration));
    }

    getTypeAtLocation(node: ts.Node): ts.Type {
        return this.toSupportedType(this.tsTypeChecker.getTypeAtLocation(node));
    }

    getContextualType(node: ts.Expression): ts.Type {
        return this.toSupportedType(this.tsTypeChecker.getContextualType(node));
    }

    typeToString(type: ts.Type): string {
        return this.tsTypeChecker.typeToString(type);
    }

    getTypeOfSymbolAtLocation(symbol: ts.Symbol, location: ts.Node): ts.Type {
        return this.toSupportedType(this.tsTypeChecker.getTypeOfSymbolAtLocation(symbol, location));
    }

    getResolvedSignature(callLikeExpression: ts.CallLikeExpression): ts.Signature {
        return new SignatureWrapper(this.tsTypeChecker.getResolvedSignature(callLikeExpression));
    }

    isImplementationOfOverload(fun: ts.FunctionLikeDeclaration): boolean {
        return this.tsTypeChecker.isImplementationOfOverload(fun);
    }

    toSupportedType(type: ts.Type): ts.Type {
        return toSupportedType(type);
    }
}

function toSupportedType(type: ts.Type): ts.Type {
    // getNonNullableType returns never for void?
    if (type.flags === ts.TypeFlags.Void) {
        return type;
    }

    // e.g. 1 | 2
    if (type.flags & ts.TypeFlags.Union) {
        const unionType = type as ts.UnionType;
        const intLiterals = unionType.types.every(type => !!(type.flags & ts.TypeFlags.IntLike));
        const numberLiterals = unionType.types.every(type => !!(type.flags & ts.TypeFlags.NumberLike));
        const booleanLiterals = unionType.types.every(type => !!(type.flags & ts.TypeFlags.BooleanLike));

        if (intLiterals || numberLiterals || booleanLiterals && unionType.types.length > 0) {
            return toSupportedType(unionType.types[0]);
        }
    }

    return type.getNonNullableType();
}

class SignatureWrapper implements ts.Signature {
    constructor(private signature: ts.Signature) {

    }

    get declaration() {
        return this.signature.declaration;
    }

    get typeParameters() {
        return this.signature.typeParameters;
    }

    get parameters() {
        return this.signature.parameters;
    }

    getDeclaration() {
        return this.signature.getDeclaration();
    }

    getTypeParameters() {
        return this.signature.getTypeParameters();
    }

    getParameters(): ts.Symbol[] {
        return this.signature.getParameters();
    }

    getReturnType(): ts.Type {
        return toSupportedType(this.signature.getReturnType());
    }

    getDocumentationComment(): ts.SymbolDisplayPart[] {
        return this.signature.getDocumentationComment();
    }
}
