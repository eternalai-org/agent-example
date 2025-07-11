export interface SchedulerListResponse {
    result: {
        id: number;
        address: string;
        container: string;
        agent_contract_address: string;
        prompt: string;
        cron: string;
    }[];
}

export interface AgentDetailResponse {
    result: {
        meta_data: {
            network_id: number;
            agent_name: string;
        };
        port: number;
    }
}