import { expect, test } from "bun:test";
import {
    escapeHtml,
    findUnsupportedDynamicImportExpression,
    isIdentifierCharacter,
    isLocalFileImportSpecifier,
    isPackageImportSpecifier,
    isRelativeImportSpecifier,
    skipQuotedString,
    skipWhitespaceAndComments,
} from "../build";

test("isRelativeImportSpecifier returns true for ./ and ../ specifiers", () => {
    expect(isRelativeImportSpecifier("./foo")).toBe(true);
    expect(isRelativeImportSpecifier("../foo")).toBe(true);
    expect(isRelativeImportSpecifier("foo")).toBe(false);
    expect(isRelativeImportSpecifier("svelte")).toBe(false);
});

test("isLocalFileImportSpecifier returns true for file: and absolute paths", () => {
    expect(isLocalFileImportSpecifier("file:///foo")).toBe(true);
    expect(isLocalFileImportSpecifier("/absolute/path")).toBe(true);
    expect(isLocalFileImportSpecifier("./foo")).toBe(false);
});

test("isPackageImportSpecifier returns true for # specifiers", () => {
    expect(isPackageImportSpecifier("#config")).toBe(true);
    expect(isPackageImportSpecifier("./foo")).toBe(false);
});

test("isIdentifierCharacter returns true for valid identifier characters", () => {
    expect(isIdentifierCharacter("a")).toBe(true);
    expect(isIdentifierCharacter("Z")).toBe(true);
    expect(isIdentifierCharacter("_")).toBe(true);
    expect(isIdentifierCharacter("$")).toBe(true);
    expect(isIdentifierCharacter("0")).toBe(true);
    expect(isIdentifierCharacter(" ")).toBe(false);
    expect(isIdentifierCharacter(undefined)).toBe(false);
});

test("skipQuotedString skips past a quoted string", () => {
    const source = "'hello world' rest";
    expect(skipQuotedString(source, 0, "'")).toBe(13);
});

test("skipQuotedString handles escaped quotes", () => {
    // The escaped quote \' is consumed as "\\" then "'" which is the closing quote.
    // 'hello\\' = 'hello\\' (closing at position 14)
    const source = "'hello\\'world' rest";
    expect(skipQuotedString(source, 0, "'")).toBe(14);
});

test("skipWhitespaceAndComments skips spaces", () => {
    const source = "   abc";
    expect(skipWhitespaceAndComments(source, 0)).toBe(3);
});

test("skipWhitespaceAndComments skips line comments", () => {
    const source = "// comment\nabc";
    expect(skipWhitespaceAndComments(source, 0)).toBe(11);
});

test("skipWhitespaceAndComments skips block comments", () => {
    const source = "/* comment */abc";
    expect(skipWhitespaceAndComments(source, 0)).toBe(13);
});

test("findUnsupportedDynamicImportExpression returns unsupported=false for static import()", () => {
    const source = 'import("./foo")';
    const result = findUnsupportedDynamicImportExpression(source);
    expect(result.unsupported).toBe(false);
});

test("findUnsupportedDynamicImportExpression returns unsupported=true for template literal import()", () => {
    const source = "import(`./foo`)";
    const result = findUnsupportedDynamicImportExpression(source);
    expect(result.unsupported).toBe(true);
});

test("findUnsupportedDynamicImportExpression returns unsupported=true for dynamic expression import()", () => {
    const source = "import(variable)";
    const result = findUnsupportedDynamicImportExpression(source);
    expect(result.unsupported).toBe(true);
});

test("findUnsupportedDynamicImportExpression handles template literals with nested expressions", () => {
    const source = "import(`./${lang}.js`)";
    const result = findUnsupportedDynamicImportExpression(source);
    expect(result.unsupported).toBe(true);
});

test("escapeHtml escapes HTML special characters", () => {
    expect(escapeHtml('<div class="test">Tom & Jerry\'s</div>')).toBe(
        "&lt;div class=&quot;test&quot;&gt;Tom &amp; Jerry&#39;s&lt;/div&gt;",
    );
});
