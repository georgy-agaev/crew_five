# Bug: company-import processing wrongly rejected whole jobs above runtime batch size

## Status

Completed on 2026-03-23.

## Problem

The post-import processing flow already used persisted `company_id`s and async chunked execution, but
`startCompanyImportProcess()` still rejected any request where `companyIds.length > 20`.

That mixed up two different concepts:

- whole async job size
- runtime chunk size for Outreach triggers

As a result, realistic operator flows like apply 122 companies -> start one processing job failed with
generic `Invalid request`, even though the job runner already knew how to process work in small chunks.

## Root Cause

`src/services/companyImportProcessing.ts` applied `DEFAULT_HARD_MAX_BATCH_SIZE = 20` to the full
`companyIds` array at job-start time instead of applying it only to runtime chunk size.

## Fix

- Added a separate whole-job safety cap:
  - `maxJobCompanyCount`
  - default `5000`
- Kept runtime chunk controls separate:
  - `recommendedBatchSize = 10`
  - `hardMaxBatchSize = 20`
- Batch size persisted into the job is now:
  - `min(recommendedBatchSize, companyIds.length, hardMaxBatchSize)`
- Whole async jobs can now accept large persisted company sets while still triggering Outreach in small
  sequential batches.

## Tests

Added regression coverage in
[companyImportProcessing.test.ts](/Users/georgyagaev/crew_five/src/services/companyImportProcessing.test.ts):

- starting a job with `122` company ids succeeds
- runner invokes `13` trigger calls for `122` ids in `10/10/.../2` chunks
- unknown company id validation still fails
- configurable whole-job safety cap still rejects oversize jobs

## Result

The architecture now matches the intended model:

1. Import preview
2. Apply selected records
3. Persist canonical companies
4. Start one async processing job over the full persisted set
5. Process companies through Outreach in small runtime batches
