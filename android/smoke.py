"""Install and exercise the actual APK on the CI emulator."""
import re
import subprocess
import time
import xml.etree.ElementTree as ET

def adb(*args):
    return subprocess.check_output(["adb", *args], text=True, errors="replace")

def wait_for(label, tap=False):
    deadline = time.monotonic() + 90
    last = []
    while time.monotonic() < deadline:
        adb("shell", "uiautomator", "dump", "/sdcard/raah-ui.xml")
        tree = ET.fromstring(adb("shell", "cat", "/sdcard/raah-ui.xml"))
        last = [(n.get("text", "") + " " + n.get("content-desc", "")).strip() for n in tree.iter("node")]
        for n in tree.iter("node"):
            if label.lower() in (n.get("text", "") + " " + n.get("content-desc", "")).lower():
                coords = list(map(int, re.findall(r"\d+", n.get("bounds", ""))))
                if not tap:
                    return
                if len(coords) == 4 and coords[2] > coords[0] and coords[3] > coords[1]:
                    adb("shell", "input", "tap", str((coords[0]+coords[2])//2), str((coords[1]+coords[3])//2))
                    return
        if tap:
            adb("shell", "input", "swipe", "460", "1200", "460", "450", "350")
        time.sleep(0.4)
    print(adb("logcat", "-d", "-t", "600", "chromium:I", "AndroidRuntime:E", "RaahSuraksha:E", "*:S")[-8000:])
    raise AssertionError((label, last))

adb("install", "-r", "build/android/Raah-Suraksha.apk")
adb("shell", "wm", "size", "1080x1920")
adb("shell", "wm", "density", "240")
adb("shell", "am", "start", "-W", "-n", "in.raahsuraksha.walk/.WalkActivity")
wait_for("Plan your route")
wait_for("Open demo walk", tap=True)
wait_for("Your walking route")
wait_for("Start trip", tap=True)
wait_for("SOS settings", tap=True)
wait_for("Trusted contact number")
wait_for("Police service number")
print("Installed APK opened a demo, started a trip and displayed both SOS contacts.")

