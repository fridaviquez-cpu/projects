// Frozen synthetic saved Markdown; every image response is supplied by the test.
export const supportedImagesMarkdown = `Saved reference images before.

![HTTPS reference image][https-image]

![Document-relative image][]

![Parent-relative image]

![Root-relative image][root-image]

[https-image]: https://example.org/synthetic-reference.svg?version=1
[Document-relative image]: ./synthetic-reference.svg?version=2
[Parent-relative image]: ../synthetic-reference.svg?version=3
[root-image]: /synthetic-reference.svg?version=4

Saved reference images after.`;

export const supportedImages = [
  { alt: "HTTPS reference image", src: "https://example.org/synthetic-reference.svg?version=1" },
  { alt: "Document-relative image", src: "./synthetic-reference.svg?version=2" },
  { alt: "Parent-relative image", src: "../synthetic-reference.svg?version=3" },
  { alt: "Root-relative image", src: "/synthetic-reference.svg?version=4" },
];
