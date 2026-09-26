// Otomatik üretildi (assets-pipeline/build-anatomy.ts). Elle düzenlemeyin.
export const MODEL_ASSETS = {
  "body": {
    "file": "body.glb",
    "bytes": 921820,
    "triangles": 35850,
    "bounds": {
      "min": [
        -0.334,
        -0.8618,
        -0.1771
      ],
      "max": [
        0.3695,
        0.9172,
        0.1378
      ]
    }
  },
  "skeleton": {
    "file": "skeleton.glb",
    "bytes": 3382888,
    "triangles": 129968,
    "bounds": {
      "min": [
        -0.3285,
        -0.8543,
        -0.1555
      ],
      "max": [
        0.3638,
        0.9135,
        0.1181
      ]
    }
  },
  "cardio": {
    "file": "cardio.glb",
    "bytes": 5509816,
    "triangles": 237780,
    "bounds": {
      "min": [
        -0.2858,
        -0.8323,
        -0.1471
      ],
      "max": [
        0.3097,
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
  },
  "muscles": {
    "file": "muscles.glb",
    "bytes": 4046004,
    "triangles": 149778,
    "bounds": {
      "min": [
        -0.325,
        -0.8545,
        -0.1591
      ],
      "max": [
        0.3567,
        0.916,
        0.134
      ]
    }
  }
} as const;

export type LoadableAsset = keyof typeof MODEL_ASSETS;
