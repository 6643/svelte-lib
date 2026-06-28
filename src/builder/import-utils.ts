export const isRelativeImportSpecifier = (specifier: string): boolean =>
    specifier.startsWith("./") || specifier.startsWith("../");

export const isLocalFileImportSpecifier = (specifier: string): boolean =>
    specifier.startsWith("file:") || specifier.startsWith("/");

export const isPackageImportSpecifier = (specifier: string): boolean =>
    specifier.startsWith("#");

export const isIdentifierCharacter = (value: string | undefined): boolean =>
    value !== undefined && /[A-Za-z0-9_$]/.test(value);

export const skipQuotedString = (source: string, start: number, quote: "'" | '"'): number => {
    let index = start + 1;

    while (index < source.length) {
        if (source[index] === "\\") {
            index += 2;
            continue;
        }

        if (source[index] === quote) {
            return index + 1;
        }

        index += 1;
    }

    return index;
};

export const skipWhitespaceAndComments = (source: string, start: number): number => {
    let index = start;

    while (index < source.length) {
        if (/\s/.test(source[index] ?? "")) {
            index += 1;
            continue;
        }

        if (source[index] === "/" && source[index + 1] === "/") {
            index += 2;
            while (index < source.length && source[index] !== "\n") {
                index += 1;
            }
            continue;
        }

        if (source[index] === "/" && source[index + 1] === "*") {
            index += 2;
            while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
                index += 1;
            }
            index = Math.min(index + 2, source.length);
            continue;
        }

        break;
    }

    return index;
};

export const findUnsupportedDynamicImportExpression = (
    source: string,
    start = 0,
    stopCharacter?: string,
): { next: number; unsupported: boolean } => {
    let index = start;

    while (index < source.length) {
        const character = source[index];

        if (stopCharacter !== undefined && character === stopCharacter) {
            return { next: index + 1, unsupported: false };
        }

        if (character === "/" && source[index + 1] === "/") {
            index = skipWhitespaceAndComments(source, index);
            continue;
        }

        if (character === "/" && source[index + 1] === "*") {
            index = skipWhitespaceAndComments(source, index);
            continue;
        }

        if (character === "'" || character === '"') {
            index = skipQuotedString(source, index, character);
            continue;
        }

        if (character === "`") {
            index += 1;
            while (index < source.length) {
                if (source[index] === "\\") {
                    index += 2;
                    continue;
                }

                if (source[index] === "`") {
                    index += 1;
                    break;
                }

                if (source[index] === "$" && source[index + 1] === "{") {
                    const nested = findUnsupportedDynamicImportExpression(source, index + 2, "}");
                    if (nested.unsupported) {
                        return nested;
                    }
                    index = nested.next;
                    continue;
                }

                index += 1;
            }
            continue;
        }

        if (
            source.startsWith("import", index) &&
            !isIdentifierCharacter(source[index - 1]) &&
            !isIdentifierCharacter(source[index + "import".length])
        ) {
            let nextIndex = skipWhitespaceAndComments(source, index + "import".length);
            if (source[nextIndex] === "(") {
                nextIndex = skipWhitespaceAndComments(source, nextIndex + 1);
                const argumentStart = source[nextIndex];

                if (argumentStart === "'" || argumentStart === '"') {
                    index = skipQuotedString(source, nextIndex, argumentStart);
                    continue;
                }

                if (argumentStart === "`") {
                    return { next: nextIndex, unsupported: true };
                }

                return { next: nextIndex, unsupported: true };
            }
        }

        index += 1;
    }

    return { next: index, unsupported: false };
};

export const escapeHtml = (value: string): string =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
