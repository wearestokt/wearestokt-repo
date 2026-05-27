import type { Collection } from "framer-plugin"
import { framer } from "framer-plugin"

import { stripExtension } from "./filename"
import type { StagedFile, UploadFailure } from "../types"

const PERMISSION = "Collection.addItems" as const

type UploadBatchParams = {
    collection: Collection
    files: StagedFile[]
    titleFieldId: string
    imageFieldId: string
    allowUnsupported: boolean
    onProgress: (current: number, total: number) => void
}

export async function uploadBatch({
    collection,
    files,
    titleFieldId,
    imageFieldId,
    allowUnsupported,
    onProgress,
}: UploadBatchParams): Promise<{ successCount: number; failures: UploadFailure[] }> {
    const filesToProcess = files.filter(
        (file) => file.status === "valid" || (allowUnsupported && file.status === "unsupported")
    )

    if (!framer.isAllowedTo(PERMISSION)) {
        throw new Error("You don't have permission to add items to this collection.")
    }

    const failures: UploadFailure[] = []
    let successCount = 0

    for (let index = 0; index < filesToProcess.length; index++) {
        const stagedFile = filesToProcess[index]
        onProgress(index + 1, filesToProcess.length)

        try {
            const title = stripExtension(stagedFile.name)

            if (stagedFile.status === "valid" && stagedFile.file) {
                const imageAsset = await framer.uploadImage({
                    image: stagedFile.file,
                    name: stagedFile.file.name,
                })

                await collection.addItems([
                    {
                        slug: title,
                        fieldData: {
                            [titleFieldId]: { type: "string", value: title },
                            [imageFieldId]: { type: "image", value: imageAsset.url },
                        },
                    },
                ])
            } else {
                // Unsupported format — create item with title only, no image.
                await collection.addItems([
                    {
                        slug: title,
                        fieldData: {
                            [titleFieldId]: { type: "string", value: title },
                        },
                    },
                ])
            }

            successCount++
        } catch (error) {
            failures.push({
                filename: stagedFile.name,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    return { successCount, failures }
}
