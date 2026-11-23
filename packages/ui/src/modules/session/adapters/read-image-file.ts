export const readImageFile = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const url = reader.result as string
      resolve(url.slice(url.indexOf(",") + 1))
    }
    reader.onerror = () => reject(reader.error ?? new Error("The image could not be read."))
    reader.readAsDataURL(file)
  })
