import {QueryClient} from '@tanstack/react-query';

export async function apiRequest(method:string, url:string, data?:any) {
    const response = await fetch(url, {
        method,
        headers: data ? {'Content-Type': 'application/json'}:{},
        body: data ? JSON.stringify(data) : undefined
        });
    if (!response.ok) {
        const error=await response.text();
        throw new Error(`Erreur ${response.status}: ${error}`);
    }

   
}

export const queryClient = new QueryClient({
    defaultOptions: {
        queries:{
            queryFn: async ({queryKey}) => {
                const [url]=queryKey as [string];
                return apiRequest('GET', url);
            },
        },
    },
});