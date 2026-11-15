#include <jni.h>
#include <cstring>
#include <string>
#include <vector>
#include "node.h"

extern "C" JNIEXPORT jint JNICALL
Java_in_raahsuraksha_walk_WalkActivity_runNode(JNIEnv* env, jclass, jobjectArray args) {
    const int count = env->GetArrayLength(args);
    std::vector<char> buffer;
    std::vector<size_t> offsets;
    for (int i = 0; i < count; ++i) {
        auto item = static_cast<jstring>(env->GetObjectArrayElement(args, i));
        const char* str = env->GetStringUTFChars(item, nullptr);
        offsets.push_back(buffer.size());
        buffer.insert(buffer.end(), str, str + std::strlen(str) + 1);
        env->ReleaseStringUTFChars(item, str);
        env->DeleteLocalRef(item);
    }
    std::vector<char*> argv;
    for (auto offset : offsets) argv.push_back(buffer.data() + offset);
    argv.push_back(nullptr);
    return node::Start(count, argv.data());
}
