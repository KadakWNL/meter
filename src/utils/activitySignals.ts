import { DEFAULT_AFK_CONFIG, DEFAULT_SIGNAL_WEIGHTS, type SignalWeights } from "./afkConfig.js";

// activity signal types
export type SignalType = 'mouse' | 'keyboard' | 'scroll' | 'video' | 'audio' | 'tabSwitch';

// single activity signal
interface ActivitySignal {
  lastActivity: number;
  idleThreshold: number;
  weight: number;
}

// media activity signal (boolean instead of timestamp)
interface MediaSignal {
  isActive: boolean;
  weight: number;
}

// all activity signals
interface ActivitySignals {
  mouse: ActivitySignal;
  keyboard: ActivitySignal;
  scroll: ActivitySignal;
  video: MediaSignal;
  audio: MediaSignal;
  tabSwitch: ActivitySignal;
}

// activity signals manager
export class ActivitySignalsManager {
  private signals: ActivitySignals;
  private weights: SignalWeights;

  constructor() {
    const now = Date.now();
    const config = DEFAULT_AFK_CONFIG;
    this.weights = { ...DEFAULT_SIGNAL_WEIGHTS };

    this.signals = {
      mouse: {
        lastActivity: now,
        idleThreshold: config.mouseIdleThreshold,
        weight: this.weights.mouse
      },
      keyboard: {
        lastActivity: now,
        idleThreshold: config.keyboardIdleThreshold,
        weight: this.weights.keyboard
      },
      scroll: {
        lastActivity: now,
        idleThreshold: config.scrollIdleThreshold,
        weight: this.weights.scroll
      },
      video: {
        isActive: false,
        weight: this.weights.video
      },
      audio: {
        isActive: false,
        weight: this.weights.audio
      },
      tabSwitch: {
        lastActivity: now,
        idleThreshold: config.rapidSwitchWindow,
        weight: this.weights.tabSwitch
      }
    };
  }

  // update activity signal
  updateSignal(type: SignalType, isActive?: boolean) {
    const now = Date.now();

    if (type === 'video' || type === 'audio') {
      // media signals are boolean
      this.signals[type].isActive = isActive ?? false;
    } else {
      // time-based signals
      this.signals[type].lastActivity = now;
    }
  }

  // update multiple signals at once (from batched messages)
  updateBatch(types: SignalType[]) {
    const now = Date.now();
    for (const type of types) {
      if (type !== 'video' && type !== 'audio') {
        this.signals[type].lastActivity = now;
      }
    }
  }

  // set weight for a signal (e.g., increase tab switch weight during rapid switching)
  setWeight(type: SignalType, weight: number) {
    this.signals[type].weight = weight;
  }

  // calculate activity score (0-100)
  calculateActivityScore(): number {
    const now = Date.now();
    let totalScore = 0;
    let maxPossibleScore = 0;

    // time-based signals
    for (const [key, signal] of Object.entries(this.signals)) {
      if ('lastActivity' in signal) {
        const timeSinceActivity = now - signal.lastActivity;
        const idleRatio = Math.min(timeSinceActivity / signal.idleThreshold, 1);
        const activityScore = (1 - idleRatio) * signal.weight;

        totalScore += activityScore;
        maxPossibleScore += signal.weight;
      }
    }

    // media signals
    if (this.signals.video.isActive) {
      totalScore += this.signals.video.weight;
    }
    if (this.signals.audio.isActive) {
      totalScore += this.signals.audio.weight;
    }
    maxPossibleScore += this.signals.video.weight + this.signals.audio.weight;

    // return percentage (0-100)
    return maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;
  }

  // check if user is active based on activity score
  isUserActive(): boolean {
    const score = this.calculateActivityScore();
    return score >= DEFAULT_AFK_CONFIG.activityScoreThreshold;
  }

  // get current activity score for debugging
  getActivityScore(): number {
    return this.calculateActivityScore();
  }

  // reset all signals (e.g., when user returns from AFK)
  resetAll() {
    const now = Date.now();
    this.signals.mouse.lastActivity = now;
    this.signals.keyboard.lastActivity = now;
    this.signals.scroll.lastActivity = now;
    this.signals.tabSwitch.lastActivity = now;
    this.signals.video.isActive = false;
    this.signals.audio.isActive = false;
  }
}
