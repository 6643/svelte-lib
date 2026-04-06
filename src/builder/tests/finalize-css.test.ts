import { expect, test } from "bun:test";

import { finalizeMergedCssAsset } from "../finalize-css";

test("finalizeMergedCssAsset minifies merged component css before hashing", async () => {
    const cssByPath = new Map([
        [
            "a.svelte",
            `
                body {
                    color: red;
                }
            `,
        ],
        [
            "b.svelte",
            `
                .button {
                    margin: 0  8px;
                }
            `,
        ],
    ]);

    const result = await finalizeMergedCssAsset(cssByPath, (content, extension) => {
        expect(extension).toBe(".css");
        return `asset-${content.length}${extension}`;
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
        throw new Error(result.error);
    }

    expect(result.value.content).toBe("body{color:red}.button{margin:0 8px}");
    expect(result.value.finalFile).toBe("asset-36.css");
});
