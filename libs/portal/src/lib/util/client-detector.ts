export type ScreenSize = "xs" | "sm" | "md" | "lg" | "xl" | "*";
export type Orientation = "portrait" | "landscape" | "*";
export type Platform = "ios" | "android" | "macos" | "windows" | "linux" | "web" | "*";

export interface ClientInfo {
  /**
   * width in px
   */
  width: number;
  /**
   * height in px
   */
  height: number;
  screen_size: string;
  orientation: string;
  pixel_ratio: number;
  platform: string;
  browser: string;
  os: string;
  os_version: string;
  capabilities: Array<string>;
  device_type?: string | null;
}

export function detectClient(): ClientInfo {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const ua = navigator.userAgent;
  const platform = navigator.platform;

  // Determine screen size category
  const screenSize = getScreenSize(width);

  // Determine orientation
  const orientation: Orientation = width > height ? "landscape" : "portrait";

  // Detect platform (check Capacitor first, then fallback to user agent)
  const platformInfo = detectPlatformWithCapacitor(ua, platform);

  // Detect capabilities
  const capabilities = detectCapabilities();

  return {
    width,
    height,
    screen_size: screenSize,
    orientation,
    pixel_ratio: window.devicePixelRatio || 1,
    platform: platformInfo.platform,
    browser: platformInfo.browser,
    os: platformInfo.os,
    os_version: platformInfo.osVersion,
    capabilities,
    device_type: inferDeviceType(width, platformInfo.platform),
  };
}

function detectPlatformWithCapacitor(ua: string, platform: string) {
  // Check if running in Capacitor
  const isCapacitor = !!(window as any).Capacitor;

  if (isCapacitor) {
    const Capacitor = (window as any).Capacitor;
    const nativePlatform = Capacitor.getPlatform(); // 'ios', 'android', or 'web'

    if (nativePlatform === 'ios') {
      return {
        platform: "ios" as Platform,
        os: Capacitor.isNativePlatform() ? "iOS (Native)" : "iOS",
        osVersion: extractIOSVersion(ua),
        browser: "capacitor",
      };
    }

    if (nativePlatform === 'android') {
      return {
        platform: "android" as Platform,
        os: "Android (Native)",
        osVersion: extractAndroidVersion(ua),
        browser: "capacitor",
      };
    }
  }

  // Fallback to regular platform detection
  return detectPlatform(ua, platform);
}

function getScreenSize(width: number): ScreenSize {
  if (width <= 480) return "xs";
  if (width <= 768) return "sm";
  if (width <= 1024) return "md";
  if (width <= 1440) return "lg";
  return "xl";
}

function detectPlatform(ua: string, platform: string) {
  // iOS Detection (including iPad on iPadOS 13+)
  if (/iPhone/.test(ua)) {
    return {
      platform: "ios" as Platform,
      os: "iOS",
      osVersion: extractIOSVersion(ua),
      browser: detectBrowser(ua),
    };
  }

  if (/iPad/.test(ua) || (platform === "MacIntel" && navigator.maxTouchPoints > 1)) {
    return {
      platform: "ios" as Platform,
      os: "iPadOS",
      osVersion: extractIOSVersion(ua),
      browser: detectBrowser(ua),
    };
  }

  // Android
  if (/Android/.test(ua)) {
    return {
      platform: "android" as Platform,
      os: "Android",
      osVersion: extractAndroidVersion(ua),
      browser: detectBrowser(ua),
    };
  }

  // Desktop platforms
  if (/Mac/.test(platform)) {
    return {
      platform: "macos" as Platform,
      os: "macOS",
      osVersion: "",
      browser: detectBrowser(ua),
    };
  }

  if (/Win/.test(platform)) {
    return {
      platform: "windows" as Platform,
      os: "Windows",
      osVersion: "",
      browser: detectBrowser(ua),
    };
  }

  if (/Linux/.test(platform)) {
    return {
      platform: "linux" as Platform,
      os: "Linux",
      osVersion: "",
      browser: detectBrowser(ua),
    };
  }

  return {
    platform: "web" as Platform,
    os: "Unknown",
    osVersion: "",
    browser: detectBrowser(ua),
  };
}

function detectBrowser(ua: string): string {
  if (/Safari/.test(ua) && !/Chrome/.test(ua)) return "safari";
  if (/Chrome/.test(ua)) return "chrome";
  if (/Firefox/.test(ua)) return "firefox";
  if (/Edg/.test(ua)) return "edge";
  return "web";
}

function detectCapabilities(): string[] {
  const caps: string[] = [];

  if ("ontouchstart" in window) caps.push("touch");
  if (navigator.maxTouchPoints > 0) caps.push("multitouch");

  // Check for stylus support (approximation)
  if (navigator.maxTouchPoints > 1 && window.devicePixelRatio > 1) {
    caps.push("stylus");
  }

  return caps;
}

function inferDeviceType(width: number, platform: Platform): "phone" | "tablet" | "desktop" {
  // Mobile platforms
  if (platform === "ios" || platform === "android") {
    return width < 768 ? "phone" : "tablet";
  }

  // Desktop platforms
  return "desktop";
}

function extractIOSVersion(ua: string): string {
  const match = ua.match(/OS (\d+)_(\d+)/);
  return match ? `${match[1]}.${match[2]}` : "";
}

function extractAndroidVersion(ua: string): string {
  const match = ua.match(/Android (\d+\.?\d*)/);
  return match ? match[1] : "";
}
