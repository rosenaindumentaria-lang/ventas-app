// Achica la foto en el celular antes de subirla. Una foto de cámara pesa 3-5 MB
// y tarda en subir con datos móviles; achicada queda en ~100 KB y sobra para
// reconocer una prenda.

async function cargarImagen(archivo: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    // Respeta la orientación de la cámara: sin esto, la foto sacada con el
    // celular parado aparece acostada.
    return await createImageBitmap(archivo, { imageOrientation: 'from-image' });
  } catch {
    const url = URL.createObjectURL(archivo);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function aJpeg(img: ImageBitmap | HTMLImageElement, ladoMax: number, calidad: number): Promise<Blob> {
  const escala = Math.min(1, ladoMax / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * escala);
  canvas.height = Math.round(img.height * escala);
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Sin canvas'));
  // Fondo blanco: un PNG con transparencia quedaría negro en el JPEG.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((ok, mal) =>
    canvas.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo convertir'))), 'image/jpeg', calidad)
  );
}

export async function prepararFoto(archivo: File) {
  const img = await cargarImagen(archivo);
  const [foto, miniatura] = await Promise.all([aJpeg(img, 1000, 0.8), aJpeg(img, 320, 0.75)]);
  if ('close' in img) img.close();
  return { foto, miniatura };
}
