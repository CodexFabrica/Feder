import { get, set } from 'idb-keyval';

export const saveProjectHandle = async (handle) => {
    await set('projectHandle', handle);
};

export const getProjectHandle = async () => {
    return await get('projectHandle');
};

export const saveRecentProject = async (handle, name, mode) => {
    let recent = await get('recentProjects') || [];
    
    // Filter out existing project with same name to move it to top
    // Note: Comparing directory handles effectively is tricky, so we rely on name for deduplication in this simple list
    recent = recent.filter(p => p.name !== name);
    
    const newEntry = { handle, name, mode, lastOpened: Date.now() };
    // Add to top, keep max 5
    const updated = [newEntry, ...recent].slice(0, 5);
    
    await set('recentProjects', updated);
};

export const getRecentProjects = async () => {
    return await get('recentProjects') || [];
};
