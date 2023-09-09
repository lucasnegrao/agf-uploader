<template>
  <div
    class="fullscreen bg-dark text-center q-pa-md flex flex-center"
    @dragenter.prevent
    @dragover.prevent
    @dragleave.prevent
    @drop.prevent
    @dragenter="handleDragEnter"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <div v-if="dragging" class="upload-container">
      <div class="content">
        <q-icon
          name="arrow_upward"
          class="upload-arrow"
          :class="{ 'upload-arrow--active': dragging }"
        />
      </div>
    </div>
    <div
      v-if="!dragging"
      class="upload-container"
      @dragover.prevent
      @drop="handleDrop"
    >
      <div class="upload-message">
        <div v-if="!uploadProgress">
          <q-icon name="arrow_upward" class="upload-arrow" />
          <p>{{ message }}</p>
        </div>
        <div v-if="uploadProgress && !uploadCompleted">
          <div class="q-pb-lg">
            <q-circular-progress
              show-value
              :value="uploadProgress"
              size="210px"
              :thickness="0.2"
            >
              {{ uploadProgress.toFixed(0) }}%
            </q-circular-progress>
          </div>
          <p class="text-caption">
            Uploading <span class="text-info ellipsis">{{ fileName }}</span>
          </p>
          <p class="text-caption">
            About
            <span class="text-info">{{ timeRemainingString }}</span> remaining
          </p>
          <p class="text-caption">
            {{ (bytesUploaded / 1000000).toFixed(2) }}mb of
            {{ (bytesTotal / 1000000).toFixed(2) }}mb uploaded
          </p>
          <p class="text-caption">
            Average speed: <span class="text-info">{{ avgSpeedHuman }}</span>
          </p>
          <p class="text-caption">
            Total upload time:
            <span class="text-info">{{ totalTimeString }}</span>
          </p>
        </div>
        <div v-if="uploadCompleted">
          <p>{{ fileName }}</p>
          <p>{{ message }}</p>
          <p>Average speed: {{ avgSpeedHuman }}</p>
          <p>Total upload time: {{ totalTimeString }}</p>
        </div>
        <div>
          <div v-if="stopped == true && uploadCompleted == false">
            <q-btn outline color="primary" label="Pause" @click="pauseUpload" />
          </div>
          <div v-if="stopped || uploadCompleted">
            <q-btn
              v-if="stopped && !uploadCompleted"
              outline
              color="primary"
              label="Start"
              @click="startOrResumeUpload(upload)"
              class="q-px-md"
            />
            <q-btn
              outline
              color="primary"
              label="Reset"
              @click="uploadFile(file, true)"
              class="q-px-md"
            />

            <q-btn
              outline
              color="primary"
              label="Back"
              @click="reload()"
              class="q-px-md"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import * as tus from 'tus-js-client';

export default {
  name: 'UploadComponent',
  data() {
    return {
      message: 'Drag and drop a file here to upload',
      avgSpeed: 0,
      uploadSpeed: 0,
      lastUploadedTime: {},
      lastUploadedBytes: 0,
      uploadProgress: 0,
      bytesUploadedSinceLastTime: 0,
      bytesTotal: 0,
      bytesUploaded: 0,
      startTime: 0,
      endTime: 0,
      secondsRemaining: 0,
      upload: {},
      stopped: false,
      started: false,
      uploadCompleted: false,
      dragging: false,
      file: {},
    };
  },
  computed: {
    timeRemainingString() {
      return formatTime(this.secondsRemaining);
    },
    totalTimeString() {
      return formatTime((this.endTime - this.startTime) / 1000);
    },
    avgSpeedHuman() {
      return formatSpeed(this.avgSpeed);
    },
  },
  methods: {
    reload() {
      this.avgSpeed = 0;
      this.uploadSpeed = 0;
      this.lastUploadedTime = {};
      this.lastUploadedBytes = 0;
      this.uploadProgress = 0;
      this.bytesUploadedSinceLastTime = 0;
      this.bytesTotal = 0;
      this.bytesUploaded = 0;
      this.startTime = 0;
      this.endTime = 0;
      this.secondsRemaining = 0;
      this.stopped = false;
      this.uploadCompleted = false;
      this.dragging = false;
      this.upload = {};
      this.file = {};
    },
    handleDragEnter(e) {
      e.preventDefault();
      this.dragging = true;
    },
    handleDragLeave(e) {
      e.preventDefault();
      this.dragging = false;
    },
    handleDrop(event) {
      event.preventDefault();
      this.dragging = false;
      const file = event.dataTransfer.files[0];
      this.uploadFile(file);
    },
    pauseUpload() {
      this.upload.abort();
      this.stopped = true;
    },
    startOrResumeUpload(up, reset = false) {
      const upload = up;
      // Check if there are any previous uploads to continue.
      if (!reset) {
        upload.findPreviousUploads().then(function (previousUploads) {
          // Found previous uploads so we select the first one.
          if (previousUploads.length) {
            //ask user if it wants to reusme
            upload.resumeFromPreviousUpload(previousUploads[0]);
          }
        });
      }
      // Start the upload
      upload.start();
      this.stopped = false;
    },
    uploadFile(file, reset = false) {
      this.file = file;
      this.fileName = file.name;
      this.uploadCompleted = false;
      this.upload = new tus.Upload(file, {
        endpoint: 'https://tusd.alma.antiglitch.co/files',
        retryDelays: [0, 1000, 3000, 5000],
        // parallelUploads: 10,
        chunkSize: 5242880,
        metadata: {
          filename: file.name,
          filetype: file.type,
        },
        onError: (error) => {
          console.log('Upload error', error);
          this.message = 'Upload failed. Please try again.';
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          // this.message = `${bytesUploaded / 1000}`;
          this.started = true;
          this.uploadProgress = (bytesUploaded / bytesTotal) * 100;
          const now = Date.now();
          if (bytesUploaded == 0) this.startTime = now;
          else this.endTime = now;

          const timeElapsed = now - this.lastUploadedTime;
          this.bytesUploadedSinceLastTime =
            bytesUploaded - this.lastUploadedBytes;
          const speed = this.bytesUploadedSinceLastTime / (timeElapsed / 1000);
          this.uploadSpeed = formatSpeed(speed);
          this.avgSpeed =
            this.bytesUploaded / ((this.endTime - this.startTime) / 1000);

          this.lastUploadedTime = now;
          this.lastUploadedBytes = bytesUploaded;
          this.bytesTotal = bytesTotal;
          this.bytesUploaded = bytesUploaded;
          this.secondsRemaining = (bytesTotal - bytesUploaded) / this.avgSpeed;
        },
        onSuccess: () => {
          this.endTime = Date.now();
          console.log('Upload success');
          this.message = 'Upload successful!';
          this.uploadCompleted = true;
        },
      });
      this.startOrResumeUpload(this.upload, reset);
    },
  },
};

function formatTime(time) {
  const seconds = Math.floor(time);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (seconds < 60) {
    return `${seconds.toFixed(0)} ${seconds != 1 ? 'seconds' : 'second'}`;
  } else if (minutes < 60) {
    // const remainingSeconds = seconds - minutes * 60;
    return `${minutes} ${minutes != 1 ? 'minutes' : 'minute'}`;
  } else if (hours < 24) {
    // const remainingMinutes = minutes - hours * 60;
    return `${hours} ${hours != 1 ? 'hours' : 'hour'}`;
  } else if (days < 7) {
    const remainingHours = hours - days * 24;
    return `${days} ${days != 1 ? 'days' : 'day'} ${remainingHours} ${
      hours > 1 ? 'hours' : 'hour'
    }`;
  } else if (weeks < 52) {
    const remainingDays = days - weeks * 7;
    return `${weeks} ${weeks != 1 ? 'weeks' : 'week'} ${remainingDays} ${
      remainingDays != 1 ? 'days' : 'day'
    }`;
  } else {
    const remainingWeeks = weeks - 52;
    return `${remainingWeeks} ${remainingWeeks != 1 ? 'years' : 'year'}`;
  }
}

function formatSpeed(speedInBytesPerSecond) {
  const speedInMbps = speedInBytesPerSecond / 1000000;
  const speedInKbps = speedInBytesPerSecond / 1000;

  if (speedInMbps >= 1) {
    return speedInMbps.toFixed(2) + ' mbps';
  } else {
    return speedInKbps.toFixed(2) + ' kbps';
  }
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Anonymous+Pro:ital,wght@0,400;0,700;1,400&display=swap');
.upload-container {
  font-family: 'Anonymous Pro', monospace;
  font-weight: 700;
  color: white;
  display: flex;
  background: #000;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 50%;
  padding: 2em;
  width: 50%;
  border: 2px dashed #ccc;
  border-radius: 5px;
}
.ellipsis {
  text-overflow: ellipsis;
}
.upload-arrow {
  font-size: 50px;
  color: white;
  margin-bottom: 20px;
  transition: transform 2s ease-in-out;
}
.upload-arrow--active {
  transform: rotate(180deg);
  font-size: 100px;
}

.upload-message {
  font-size: 16px;
  color: white;
  text-align: center;
}
</style>
