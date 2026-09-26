// Otomatik üretildi (assets-pipeline/build-anatomy.ts). Elle düzenlemeyin.
export const MODEL_ASSETS = {
  "body": {
    "file": "body.glb",
    "bytes": 762808,
    "triangles": 32000,
    "bounds": {
      "min": [
        -0.5237,
        -0.9146,
        -0.1606
      ],
      "max": [
        0.523,
        0.9149,
        0.1556
      ]
    }
  },
  "skeleton": {
    "file": "skeleton.glb",
    "bytes": 1740012,
    "triangles": 70766,
    "bounds": {
      "min": [
        -0.1349,
        -0.0331,
        -0.1161
      ],
      "max": [
        0.1455,
        0.7619,
        0.0537
      ]
    }
  },
  "cardio": {
    "file": "cardio.glb",
    "bytes": 4475032,
    "triangles": 195816,
    "bounds": {
      "min": [
        -0.1107,
        -0.0397,
        -0.089
      ],
      "max": [
        0.1229,
        0.8288,
        0.0969
      ]
    }
  },
  "respiratory": {
    "file": "respiratory.glb",
    "bytes": 1776188,
    "triangles": 69797,
    "bounds": {
      "min": [
        -0.1247,
        0.3856,
        -0.0909
      ],
      "max": [
        0.1335,
        0.6601,
        0.0973
      ]
    }
  },
  "digestive": {
    "file": "digestive.glb",
    "bytes": 1491580,
    "triangles": 58633,
    "bounds": {
      "min": [
        -0.1332,
        -0.0389,
        -0.0896
      ],
      "max": [
        0.1431,
        0.4544,
        0.139
      ]
    }
  },
  "urinary": {
    "file": "urinary.glb",
    "bytes": 1335588,
    "triangles": 50987,
    "bounds": {
      "min": [
        -0.0969,
        -0.0083,
        -0.0687
      ],
      "max": [
        0.1094,
        0.3564,
        0.0549
      ]
    }
  },
  "nervous": {
    "file": "nervous.glb",
    "bytes": 1566324,
    "triangles": 55999,
    "bounds": {
      "min": [
        -0.0683,
        0.2845,
        -0.0847
      ],
      "max": [
        0.0681,
        0.9025,
        0.0821
      ]
    }
  },
  "immune": {
    "file": "immune.glb",
    "bytes": 277500,
    "triangles": 10730,
    "bounds": {
      "min": [
        -0.0267,
        0.3107,
        -0.0808
      ],
      "max": [
        0.1363,
        0.5758,
        0.0608
      ]
    }
  }
} as const;

export type LoadableAsset = keyof typeof MODEL_ASSETS;
