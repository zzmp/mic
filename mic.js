!!function(window) {
window.mic = mic

/* Example:
 * var microphone
 *
 * mic(function(err, m) {
 *  microphone = m
 *  m.record()
 * // Wait a few seconds
 *  m.stop()
 *  m.play()
 *  m.exportWAV(function(blob) {
 *      $.post('/db', blob)
 *  })
 */

function mic(cb, config) {
    errors = {
        COMPATIBILITY: new Error('[mic] Compatibility Error: requires getUserMedia and AudioContext'),
        PERMISSION: new Error('[mic] Permission Error: requires user audio permissions'),
    }

    config = config || { workerPath: 'recorder/recorderWorker.js' }

    // Compatibility check
    if (!(navigator.getUserMedia ||
          (navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia))) {
        return cb(errors.COMPATIBILITY)
    }
    if (!(window.AudioContext ||
          (window.AudioContext = window.webkitAudioContext))) {
        return cb(errors.COMPATIBILITY)
    }

    // Audio setup
    var context = new AudioContext()

    // Configure Mic
    Mic.prototype.record = record
    Mic.prototype.stop = stop
    Mic.prototype.play = play
    Mic.prototype.pause = pause
    Mic.prototype.exportWAV = exportWAV
    Mic.prototype.download = download

    function Mic(stream) {
        this.input = context.createMediaStreamSource(stream)
        this.recorder = new Recorder(this.input, config)
        this.source
        this.tracking = -1
        this.recording = false
    }

    // Permission
    navigator.getUserMedia({audio: true}, onUserMediaSuccess, onUserMediaFailure)

    function onUserMediaSuccess(stream) {
        cb(null, new Mic(stream))
    }

    function onUserMediaFailure() {
        cb(errors.PERMISSION)
    }

    // Recording functions
    function record() {
        if (this.recording) this.recorder.stop()
        this.recorder.clear()
        this.recorder.record()
        this.buffer

        this.recording = true
        this.tracking = -1
    }

    function stop() {
        this.recorder.stop()
        this.recording = false

        var that = this
        this.recorder.getBuffer(function(buffers) {
            var buffer = that.buffer = context.createBuffer(2, buffers[0].length, context.sampleRate)
            buffer.getChannelData(0).set(buffers[0])
            buffer.getChannelData(1).set(buffers[1])

            that.tracking = 0
        })
    }

    // Playback functions
    function play(when) {
        if (this.tracking < 0) throw new Error('No buffer to play')

        var source = this.source = context.createBufferSource()
        source.buffer = this.buffer
        source.connect(context.destination)

        this.tracking = arguments.length ? when : this.tracking
        if (this.tracking > source.buffer.duration) this.tracking = 0

        var that = this
        source.onended = function(e) {
            that.tracking = 0
        }

        source.start(0, this.tracking)
        source.startTime = context.currentTime
    }

    function pause() {
        var source = this.source
        if (!source) return

        var that = this
        source.onended = function(e) {
            that.tracking += context.currentTime - source.startTime
        }

        source.stop()
    }

    // Download functions
    function exportWAV(cb, type) {
        this.recorder.exportWAV(cb, type)
    }

    function download(filename) {
        this.recorder.exportWAV(function(blob) {
            Recorder.forceDownload(blob, filename)
        })
    }
}
}(window)
