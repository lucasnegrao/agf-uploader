import express, { Request, Response } from 'express'
import multer from 'multer'
import path from 'path'

const app = express()
const upload = multer({ dest: path.join(__dirname, 'uploads') })

app.post('/upload', upload.single('file'), (req: Request, res: Response) => {
  const file = req.file
  if (!file) {
    res.status(400).send('No file uploaded')
    return
  }
  res.status(200).send('File uploaded successfully')
})

export default app
