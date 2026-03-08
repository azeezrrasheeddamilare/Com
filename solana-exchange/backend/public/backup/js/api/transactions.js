// Transaction API calls
export async function getTransactions() {
    const res = await fetch('/api/transactions', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
}
