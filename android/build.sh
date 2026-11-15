#!/usr/bin/env bash
# Run from a Linux checkout with the Android SDK, NDK, JDK 17+ and Node 22+.
set -euo pipefail
cd "$(dirname "$0")/.."
sdk=${ANDROID_HOME:?Set ANDROID_HOME}
ndk=${ANDROID_NDK_HOME:-$(find "$sdk/ndk" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1)}
bt="$sdk/build-tools/35.0.0"
platform="$sdk/platforms/android-35/android.jar"
tool="$ndk/toolchains/llvm/prebuilt/linux-x86_64"
out=$(mktemp -d)
trap 'rm -rf "$out"' EXIT
mkdir -p "$out"/{classes,dex,package,assets/app} build/android
npm ci
npm run build
cp -r dist "$out/assets/app/web"
cp android/server.cjs "$out/assets/app/"
node_modules/.bin/esbuild routing-api.js --platform=node --target=node18.20 --format=cjs --bundle --outfile="$out/assets/app/services.cjs"
curl --fail --location --retry 3 -o "$out/node.zip" https://github.com/nodejs-mobile/nodejs-mobile/releases/download/v18.20.4/nodejs-mobile-v18.20.4-android.zip
unzip -q "$out/node.zip" -d "$out/node"
header=$(dirname "$(find "$out/node" -name node.h | head -1)")
for abi in arm64-v8a armeabi-v7a x86_64; do
    case $abi in
        arm64-v8a) triple=aarch64-linux-android; sys=aarch64-linux-android ;;
        armeabi-v7a) triple=armv7a-linux-androideabi; sys=arm-linux-androideabi ;;
        x86_64) triple=x86_64-linux-android; sys=$triple ;;
    esac
    lib="$out/package/lib/$abi"
    mkdir -p "$lib"
    cp "$(find "$out/node" -path "*/$abi/libnode.so" | head -1)" "$lib/"
    cp "$tool/sysroot/usr/lib/$sys/libc++_shared.so" "$lib/"
    cc="$tool/bin/${triple}26-clang++"
    "$cc" -std=c++17 -O2 -fPIC -shared -Wl,-z,max-page-size=16384 -I"$header" android/runtime.cpp -L"$lib" -lnode -o "$lib/libraah.so"
    "$cc" -std=c++17 -O2 -fPIE -pie -static-libstdc++ -Wl,-z,max-page-size=16384 scoring/scorer.cpp -o "$lib/libscorer.so"
done
javac --release 8 -classpath "$platform" -d "$out/classes" android/WalkActivity.java
jar cf "$out/classes.jar" -C "$out/classes" .
"$bt/d8" --min-api 26 --lib "$platform" --output "$out/dex" "$out/classes.jar"
"$bt/aapt2" compile --dir android/res -o "$out/resources.zip"
"$bt/aapt2" link -I "$platform" --manifest android/AndroidManifest.xml -A "$out/assets" -o "$out/plain.apk" "$out/resources.zip"
cp "$out/dex/classes.dex" "$out/package/"
(cd "$out/package" && zip -q -r "$out/plain.apk" classes.dex lib)
"$bt/zipalign" -f -p 4 "$out/plain.apk" "$out/aligned.apk"
key=${RAAH_ANDROID_KEYSTORE:-"$out/demo.jks"}
if [[ -z "${RAAH_ANDROID_KEYSTORE:-}" ]]; then
    export RAAH_ANDROID_PASSWORD=$(openssl rand -hex 24)
    keytool -genkeypair -keystore "$key" -storepass:env RAAH_ANDROID_PASSWORD -keypass:env RAAH_ANDROID_PASSWORD -alias raah -keyalg RSA -keysize 3072 -validity 3650 -dname 'CN=Raah Suraksha Hackathon'
fi
apk=build/android/Raah-Suraksha.apk
"$bt/apksigner" sign --ks "$key" --ks-key-alias raah --ks-pass env:RAAH_ANDROID_PASSWORD --out "$apk" "$out/aligned.apk"
"$bt/apksigner" verify --verbose --print-certs "$apk"
"$bt/aapt" dump badging "$apk" | head -20 || true
(cd build/android && sha256sum Raah-Suraksha.apk > Raah-Suraksha.apk.sha256)

