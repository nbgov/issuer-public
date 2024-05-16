const DefaultMaxSize = 16 * 1024 * 1024; // 16mb

export const readBody = async (req, maxSize = DefaultMaxSize) => {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    if ((size += chunk.length) > maxSize) {
      return;
    }

    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString();
};
