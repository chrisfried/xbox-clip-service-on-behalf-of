require('dotenv').config()
import express, { Application, Request, Response } from 'express'
import cors from 'cors'
import { AuthorizeXbox, GetXuid, GetClips } from './xbox'
import NodeCache from 'node-cache'

const bl3TokenCache = new NodeCache({
  stdTTL: 60 * 90,
})
const xuidCache = new NodeCache({
  stdTTL: 60 * 60 * 24,
})

const app: Application = express()
const port = 3000

// Body parsing Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

var allowedOrigins = [
  'http://localhost:4200',
  'https://alpha.guardian.theater',
  'https://guardian.theater',
]
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true)
      if (allowedOrigins.indexOf(origin) === -1) {
        var msg =
          'The CORS policy for this site does not ' +
          'allow access from the specified Origin.'
        return callback(new Error(msg), false)
      }
      return callback(null, true)
    },
  })
)

app.get('/', async (req: Request, res: Response): Promise<Response> => {
  return res.status(200).send({
    message: 'Hello World!',
  })
})

app.get(
  '/destiny2/:gamertag',
  async (req: Request, res: Response): Promise<Response> => {
    const access_token = req.header('Authorization')
    let xbl3Token: string | undefined = access_token
      ? bl3TokenCache.get(access_token)
      : undefined
    if (!xbl3Token) {
      try {
        xbl3Token = await AuthorizeXbox(access_token || '')
        bl3TokenCache.set(access_token!, xbl3Token)
      } catch (e: any) {
        if (e.response.status === 429) {
          return res
            .status(429)
            .send(e.response.data || { message: 'Too many requests' })
        }
        return res.status(401).send({
          message: 'Unauthorized',
        })
      }
    }

    let xuid: string | undefined = xuidCache.get(req.params.gamertag)
    if (!xuid) {
      try {
        xuid = await GetXuid(req.params.gamertag, xbl3Token)
        xuidCache.set(req.params.gamertag, xuid)
      } catch (e: any) {
        if (e.response.status === 429) {
          return res
            .status(429)
            .send(e.response.data || { message: 'Too many requests' })
        }
        return res.status(500).send({
          message: 'Error getting xuid',
        })
      }
    }

    try {
      const clips = await GetClips(144389848, xuid, xbl3Token)
      return res.status(200).send({
        clips,
      })
    } catch (e: any) {
      if (e.response.status === 429) {
        return res
          .status(429)
          .send(e.response.data || { message: 'Too many requests' })
      }
      return res.status(500).send({
        message: 'Error getting clips',
      })
    }
  }
)

try {
  app.listen(port, (): void => {
    console.log(`Connected successfully on port ${port}`)
  })
} catch (error: any) {
  console.error(`Error occured: ${error.message}`)
}
