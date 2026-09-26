plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

fun env(name: String): String? = System.getenv(name)?.takeUnless { it.isBlank() }

val runNumber = env("GITHUB_RUN_NUMBER")?.toIntOrNull() ?: 1

// Web çekirdeği (apps/web/dist) APK'ya varlık olarak kopyalanır. Önce `pnpm build` gerekir.
val webDist = rootProject.file("../web/dist")
val webAssetsDir = layout.buildDirectory.dir("generated/webassets")

val copyWebAssets by tasks.registering(Sync::class) {
    group = "build"
    description = "Web derlemesini APK varlıklarına kopyalar"
    from(webDist) {
        exclude("_headers", "sw.js")
    }
    into(webAssetsDir.map { it.dir("web") })
    doFirst {
        if (!webDist.resolve("index.html").exists()) {
            throw GradleException("Web derlemesi bulunamadı: önce depo kökünde 'pnpm install && pnpm build' çalıştır.")
        }
    }
}

android {
    namespace = "com.kanharitasi.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.kanharitasi.app"
        // API 30: cihaz kimlik bilgisi + CryptoObject birlikte (BiometricPrompt) ve
        // setUserAuthenticationParameters için gereken en düşük sürüm.
        minSdk = 30
        targetSdk = 35
        versionCode = runNumber
        versionName = "1.0.$runNumber"
        buildConfigField("boolean", "WEB_DEBUG", (project.findProperty("webDebug") == "true").toString())
    }

    signingConfigs {
        create("kh") {
            // GitHub gizli anahtarı tanımlıysa (KH_KEYSTORE_*) o kullanılır; yoksa depodaki
            // HATA AYIKLAMA anahtarı. README'deki "Kendi imza anahtarın" bölümüne bak.
            storeFile = file(env("KH_KEYSTORE_PATH") ?: "../keystore/kh-debug.jks")
            storePassword = env("KH_KEYSTORE_PASSWORD") ?: "khdebug123"
            keyAlias = env("KH_KEY_ALIAS") ?: "khdebug"
            keyPassword = env("KH_KEY_PASSWORD") ?: "khdebug123"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.getByName("kh")
        }
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
            signingConfig = signingConfigs.getByName("kh")
        }
    }

    sourceSets["main"].assets.srcDir(webAssetsDir)

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    androidResources {
        // Zaten sıkıştırılmış veya büyük ikili dosyalar: sıkıştırmadan paketle, hızlı açılır.
        noCompress += listOf("glb", "wasm", "traineddata", "gz", "png", "jpg")
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
    lint {
        abortOnError = true
        checkReleaseBuilds = true
        warningsAsErrors = false
    }
}

tasks.named("preBuild") {
    dependsOn(copyWebAssets)
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.fragment.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.foundation)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.webkit)
    implementation(libs.androidx.biometric)
}
