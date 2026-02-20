// AFK detection configuration
// All timings are privacy-respecting and performance-optimized

export interface AFKConfig {
  // system idle threshold (in seconds)
  idleThreshold: number;
  
  // grace period before marking as AFK (in milliseconds)
  gracePeriod: number;
  
  // activity signal timeouts (in milliseconds)
  mouseIdleThreshold: number;
  keyboardIdleThreshold: number;
  scrollIdleThreshold: number;
  
  // media check interval (in milliseconds)
  mediaCheckInterval: number;
  
  // message batching interval (in milliseconds)
  batchInterval: number;
  
  // rapid tab switching detection
  rapidSwitchCount: number;
  rapidSwitchWindow: number;
  
  // window focus short switch threshold (in milliseconds)
  shortFocusSwitchThreshold: number;
  
  // activity score threshold (0-100)
  activityScoreThreshold: number;
}

// default AFK configuration
export const DEFAULT_AFK_CONFIG: AFKConfig = {
  idleThreshold: 120,              // 2 minutes for system idle
  gracePeriod: 10000,              // 10 second grace period
  mouseIdleThreshold: 90000,       // 1.5 minutes
  keyboardIdleThreshold: 120000,   // 2 minutes
  scrollIdleThreshold: 60000,      // 1 minute
  mediaCheckInterval: 5000,        // check media every 5 seconds
  batchInterval: 1000,             // batch messages every 1 second
  rapidSwitchCount: 3,             // 3 switches = rapid
  rapidSwitchWindow: 5000,         // within 5 seconds
  shortFocusSwitchThreshold: 30000, // 30 seconds = short switch
  activityScoreThreshold: 20       // 20% activity required to not be AFK
};

// signal weights for activity scoring
export interface SignalWeights {
  mouse: number;
  keyboard: number;
  scroll: number;
  video: number;
  audio: number;
  tabSwitch: number;
}

export const DEFAULT_SIGNAL_WEIGHTS: SignalWeights = {
  mouse: 1.0,      // normal weight
  keyboard: 1.5,   // higher - typing is strong signal
  scroll: 0.8,     // lower - might be accidental
  video: 2.0,      // very high - watching is active
  audio: 1.5,      // high - listening is active
  tabSwitch: 1.0   // normal (increases with rapid switching)
};
