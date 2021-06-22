const getType = require("../src/Functions/Files/type");

test("Get type of js", () => {
    expect(getType("hello.js")).toBe("JavaScript")
})

test("Get type of html", () => {
    expect(getType("hello.html")).toBe("HyperText Markup Language")
    expect(getType("hello.htm")).toBe("HyperText Markup Language")
    expect(getType("hello.xhtml")).toBe("HyperText Markup Language")
    expect(getType("hello.html_vm")).toBe("HyperText Markup Language")
})

test("Get type of images", () => {
    expect(getType("hello.jpg")).toBe("Image")
    expect(getType("hello.jpeg")).toBe("Image")
    expect(getType("hello.png")).toBe("Image")
    expect(getType("hello.webp")).toBe("Image")
    expect(getType("hello.svg")).toBe("Image")
})

test("Get type of videos", () => {
    expect(getType("hello.mp4")).toBe("Video")
    expect(getType("hello.mpeg")).toBe("Video")
    expect(getType("hello.mov")).toBe("Video")
    expect(getType("hello.wmv")).toBe("Video")
    expect(getType("hello.webm")).toBe("Video")
})