// User API calls
export async function getUser(userId) {
    const res = await fetch(`/api/user/${userId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
}
