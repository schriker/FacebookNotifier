const axios = require('axios')
const EventEmitter = require('events')
const { spawn } = require('child_process')
const config = require('./config.json')

class Facebook extends EventEmitter {
  constructor(facebookId) {
    super()
    this.facebookId = facebookId
    this.isOnline = null
    this.listener()
  }

  listener() {
    setInterval(async () => {
      const facebookResponse = await axios.get(
        `https://www.facebook.com/pages/videos/search/?page_id=${this.facebookId}&__a`
      )
      const facebookVideos = JSON.parse(
        facebookResponse.data.split('for (;;);').pop()
      )
      const lastVideo = facebookVideos.payload.page.video_data[0]
      const { viewCount, videoID } = lastVideo
      const isOnline = viewCount === '0'

      if (this.isOnline !== isOnline) {
        this.isOnline = isOnline
        if (this.isOnline) {
          console.log(`Facebook: [Online] - ${videoID} - ${new Date()}`)
          this.emit('online')
          this.startDownload(videoID)
        } else if (!this.isOnline) {
          console.log(`Facebook: [Offline] - ${videoID} - ${new Date()}`)
          this.emit('offline')
        }
      }
    }, 1500)
  }

  async startDownload(videoID) {
    const streamlink = spawn('streamlink', [
      `https://www.facebook.com/${this.facebookId}/videos/${videoID}`,
      '1080p_alt',
      '-O'
    ])
    const ffmpeg = spawn('ffmpeg', [
      '-re',
      '-i',
      'pipe:0',
      '-c:v',
      'copy',
      '-f',
      'flv',
      `rtmp://a.rtmp.youtube.com/live2/${config.YT_API.STREAM_KEY}`
    ])

    streamlink.stdout.on('data', data => {
      ffmpeg.stdin.write(data)
    })

    streamlink.stderr.on('data', data => {
      console.log(`streamlink: ${data}`)
    })

    streamlink.on('close', code => {
      if (code !== 0) {
        console.log(`streamlink process exited with code ${code}`)
      }
      ffmpeg.stdin.end()
    })

    ffmpeg.stderr.on('data', data => {
      console.log(`ffmpeg: ${data}`)
    })

    ffmpeg.on('close', code => {
      if (code !== 0) {
        console.log(`ffmpeg process exited with code ${code}`)
      }
    })
  }
}

new Facebook('369632869905557')

module.exports = Facebook
