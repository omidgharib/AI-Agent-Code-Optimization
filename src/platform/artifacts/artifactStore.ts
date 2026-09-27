export interface ArtifactRef { id: string; sha256: string; mediaType: string; size?: number }
export interface ArtifactStore { put(bytes: Uint8Array, mediaType: string): Promise<ArtifactRef>; get(id: string): Promise<Uint8Array | undefined> }
