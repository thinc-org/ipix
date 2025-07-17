# How To

## Setting Up

1. Download [MinIO S3](https://min.io/download?license=agpl)
2. Run MinIO S3 (OPTIONAL: With port `9000`, Use default credential: `minioadmin`)
3. Create a bucket (OPTIONAL: name it `test1`)

## Q&A

### Where's the `.env`??

ANS: Currently, the `.env` is loaded at run time from the caller (In this case, the FE / BE), so the `.env` file from this package will not be loaded.
