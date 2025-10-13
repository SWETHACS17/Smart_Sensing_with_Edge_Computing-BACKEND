# python/zscore.py
import sys
import json
import math

def main():
    try:
        raw = sys.stdin.read()
        if not raw:
            print(json.dumps({"status":"Normal","zscore":None}))
            return
        payload = json.loads(raw)
        history = payload.get("history", []) or []
        value = payload.get("value", None)
        if value is None:
            print(json.dumps({"status":"Normal","zscore":None}))
            return

        # Convert to floats and filter NaN
        hist = []
        for x in history:
            try:
                hist.append(float(x))
            except:
                pass

        # If not enough historical samples, classify as Normal (or you can choose to flag)
        if len(hist) < 2:
            print(json.dumps({"status":"Normal","zscore":None}))
            return

        mean = sum(hist) / len(hist)
        var = sum((x - mean)**2 for x in hist) / (len(hist) - 1)  # sample variance
        std = math.sqrt(var) if var >= 0 else 0.0

        if std == 0 or math.isnan(std):
            print(json.dumps({"status":"Normal","zscore":None}))
            return

        zscore = (float(value) - mean) / std

        # threshold (absolute)
        THRESH = 3.0
        status = "Outlier" if abs(zscore) >= THRESH else "Normal"

        out = {"status": status, "zscore": zscore}
        print(json.dumps(out))
    except Exception as e:
        # on error, return Normal
        try:
            print(json.dumps({"status":"Normal","zscore":None}))
        except:
            pass

if __name__ == "__main__":
    main()
