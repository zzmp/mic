!!function(window) {
window.mic = mic

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

    // Permission
    navigator.getUserMedia({audio: true}, onUserMediaSuccess, onUserMediaFailure)

    function onUserMediaSuccess(stream) { cb(new Mic(stream)) }
    function onUserMediaFailure() { cb(errors.Permission) }

    // Mic
    function Mic(stream) {
        this.input = context.createMediaStreamSource(stream)
        this.recorder = new Recorder(this.input, config)
        this.source
        this.tracking = -1
        this.recording = false
    }

    // Recording functions
    Mic.prototype.record = function record() {
        if (this.recording) this.recorder.stop()
        this.recorder.clear()
        this.recorder.record()
        this.buffer

        this.recording = true
        this.tracking = -1
    }

    Mic.prototype.stop = function stop() {
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
    Mic.prototype.play = function play(when) {
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

    Mic.prototype.pause = function pause() {
        var source = this.source
        if (!source) return

        var that = this
        source.onended = function(e) {
            that.tracking += context.currentTime - source.startTime
        }

        source.stop()
    }

    // Download functions
    Mic.prototype.exportWAV = function exportWAV(cb, type) {
        this.recorder.exportWAV(cb, type)
    }

    Mic.prototype.download = function download(filename) {
        this.recorder.exportWAV(function(blob) {
            Recorder.forceDownload(blob, filename)
        })
    }
}
}(window)
