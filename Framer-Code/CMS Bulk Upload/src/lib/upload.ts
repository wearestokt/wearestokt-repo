import type { Collection } from "framer-plugin"
import { framer } from "framer-plugin"

import { stripExtension } from "./filename"
import type { StagedFile, UploadFailure } from "../types"

type UploadBatchParams = {
    collection: Collection
    files: StagedFile[]
    titleFieldId: string
    imageFieldId: string
    onProgress: (current: number, total: number) => void
}

export async function uploadBatch({
    collection,
    files,
    titleFieldId,
    imageFieldId,
    onProgress,
}: UploadBatchParams): Promise<{ successCount: number; failures: UploadFailure[] }> {
    const validFiles = files.filter((file): file is StagedFile & { file: File } => file.status === "valid" && !!file.file)
    const failures: UploadFailure[] = []
    let successCount = 0

    for (let index = 0; index < validFiles.length; index++) {
        const stagedFile = validFiles[index]
        const file = stagedFile.file
        onProgress(index + 1, validFiles.length)

        try {
            const title = stripExtension(file.name)
            const imageAsset = await framer.uploadImage({
                image: file,
                name: file.name,
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
