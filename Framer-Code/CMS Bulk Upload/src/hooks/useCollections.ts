import type { Collection } from "framer-plugin"
import { framer } from "framer-plugin"
import { useEffect, useState } from "react"

function isWritableCollection(collection: Collection): boolean {
    return collection.managedBy === "user" && !collection.readonly
}

export function useCollections() {
    const [collections, setCollections] = useState<Collection[]>([])
    const [selectedCollectionId, setSelectedCollectionId] = useState<string>("")
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false

        async function loadCollections() {
            setLoading(true)
            setError(null)

            try {
                const [allCollections, activeCollection] = await Promise.all([
                    framer.getCollections(),
                    framer.getActiveCollection(),
                ])

                if (cancelled) return

                const writableCollections = allCollections.filter(isWritableCollection)
                setCollections(writableCollections)

                if (
                    activeCollection &&
                    isWritableCollection(activeCollection) &&
                    writableCollections.some((collection) => collection.id === activeCollection.id)
                ) {
                    setSelectedCollectionId(activeCollection.id)
                } else if (writableCollections.length === 1) {
                    setSelectedCollectionId(writableCollections[0].id)
                }
            } catch (loadError) {
                if (cancelled) return
                setError(loadError instanceof Error ? loadError.message : String(loadError))
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        void loadCollections()

        return () => {
            cancelled = true
        }
    }, [])

    const selectedCollection =
        collections.find((collection) => collection.id === selectedCollectionId) ?? null

    return {
        collections,
        selectedCollection,
        selectedCollectionId,
        setSelectedCollectionId,
        loading,
        error,
    }
}
