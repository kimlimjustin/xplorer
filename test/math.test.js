const formatBytes = require("../outs/src/Functions/Math/filesize").default;

test("Format Bytes", () => {
    expect(formatBytes(1024)).toBe("1 KB")
    expect(formatBytes(102)).toBe("102 Bytes")
    expect(formatBytes(2097052)).toBe("2 MB")
    expect(formatBytes(1073741824)).toBe("1 GB")
    expect(formatBytes(1073741824)).toBe("1 GB")
    expect(formatBytes(6356551598)).toBe("5.92 GB")
})