const fs = require('fs')
const axios = require('axios')
const youtubeUpload = require('./youtube')
const { exec, spawn } = require('child_process')

class FacebookNotifier {
  constructor(facebookId) {
    this.facebookId = facebookId
    this.isOnline = null
    this.listener()
  }

  listener() {
    const interval = setInterval(async () => {
      const facebookResponse = await axios.get(`https://www.facebook.com/pages/videos/search/?page_id=${this.facebookId}&__a`)
      const facebookVideos = JSON.parse(facebookResponse.data.split('for (;;);').pop())
      const lastVideo = facebookVideos.payload.page.video_data[0]
      const { viewCount, videoID } = lastVideo
      const isOnline = viewCount === '0'
      if (this.isOnline !== isOnline) {
        this.isOnline = isOnline
        if (this.isOnline) {
          console.log(`[Online] - ${videoID} - ${new Date()}`)
          this.isOnline = true
          this.startDownload(videoID)
          clearInterval(interval)
        } else if (!this.isOnline) {
          this.isOnline = false
          console.log(`[Offline] - ${videoID} - ${new Date()}`)
        }
      }
    }, 1500)
  }

  startDownload(videoID) {
    const comand = exec(`streamlink -o "${videoID}.ts" https://www.facebook.com/${this.facebookId}/videos/${videoID} worst`, (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`)
        return
      }
      console.log(stdout)
      console.error(stderr)
      this.stopDownload(videoID)
    })
    comand.stdout.on('data', (data) => {
      console.log(data.toString())
    })
  }

  async stopDownload(videoID) {
    const comand = spawn('ffmpeg', ['-i', `${videoID}.ts`, '-f', 'matroska', 'pipe:1'])

    comand.stderr.on('data', (data) => {
      console.log(`stderr: ${data}`)
    })

    comand.on('close', (code) => {
        console.log(`child process exited with code ${code}`)
    })

    try {
      await youtubeUpload(comand.stdout, { facebookId: videoID })
      fs.unlinkSync(`${videoID}.ts`)
      console.log(`Video - ${videoID} - uploaded - ${new Date()}`)
      this.listener()
    } catch (err) {
      console.log(err)
    }
  }
}

new FacebookNotifier('369632869905557')