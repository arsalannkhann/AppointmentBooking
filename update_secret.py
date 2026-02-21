import subprocess
import os

password = r"fDXhX4/yhrQh^6yM"

with open("temp_secret.txt", "w") as f:
    f.write(password)

print(f"Adding secret: {password}")

result = subprocess.run([
    "gcloud", "secrets", "versions", "add", "meddent-db-password", 
    "--data-file=temp_secret.txt", "--project=salesos-473014"
], capture_output=True, text=True)

print("STDOUT:", result.stdout)
print("STDERR:", result.stderr)

os.remove("temp_secret.txt")
