import type { Collection, Field, ImageField, StringField } from "framer-plugin"
import { useEffect, useState } from "react"

type CollectionFieldsState = {
    stringFields: StringField[]
    imageFields: ImageField[]
    loading: boolean
    error: string | null
}

const initialState: CollectionFieldsState = {
    stringFields: [],
    imageFields: [],
    loading: false,
    error: null,
}

function isStringField(field: Field): field is StringField {
    return field.type === "string"
}

function isImageField(field: Field): field is ImageField {
    return field.type === "image"
}

export function useCollectionFields(collection: Collection | null) {
    const [state, setState] = useState<CollectionFieldsState>(initialState)

    useEffect(() => {
        if (!collection) {
            setState(initialState)
            return
        }

        let cancelled = false

        async function loadFields() {
            setState((current) => ({ ...current, loading: true, error: null }))

            try {
                const fields = await collection.getFields()
                if (cancelled) return

                setState({
                    stringFields: fields.filter(isStringField),
                    imageFields: fields.filter(isImageField),
                    loading: false,
                    error: null,
                })
            } catch (loadError) {
                if (cancelled) return
                setState({
                    stringFields: [],
                    imageFields: [],
                    loading: false,
                    error: loadError instanceof Error ? loadError.message : String(loadError),
                })
            }
        }

        void loadFields()

        return () => {
            cancelled = true
        }
    }, [collection])

    return state
}
