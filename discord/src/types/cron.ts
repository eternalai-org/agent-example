export interface SchedulerListResponse {
    result: SchedulerDetailResponse[];
}

export interface SchedulerDetailResponse {
    id: number;
    address: string;
    name: string;
    prompt: string;
    cron: string;
}

export interface AgentDetailResponse {
    status: string;
    container_name: string;
    meta_data: {
        network_id: number;
        agent_name: string;
        nft_token_id: string;
    };
    port: number;
}

export interface ScheduleResp {
    id: number;
    name: string;
    cron: string;
    steps: ScheduleStepResp[];
}

export interface ScheduleStepResp {
    id: number;
    agent_id: number;
    agent_name: string;
    prompt: string;
    nft_id: string;
}