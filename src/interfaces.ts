import { ObjectId } from "mongodb";

export interface FormattedThreadOutput {
    formatted_title: string;
    author: string,
    create_time: string,
    last_reply_time: string,
    formatted_posts: string[];
}

export interface LowDBData {
    threads: {
        [oid: string]: { // Use the $oid as the key
            thread_id: string;
            formatted_thread: FormattedThreadOutput
            llm_analyze?: [string]
        };
    };
    lastId: ObjectId | null; // To store the last processed _id
}

export interface User {
    user_id: string;
    nickname: string;
    level: number;
    gender: string;
    status: number;
    level_name: string;
    is_following: boolean;
    is_blocked: boolean;
    is_disappear: boolean;
    is_newbie: boolean;
}

export interface Category {
    cat_id: string;
    name: string;
    postable: boolean;
}

export interface SubCategory {
    sub_cat_id: string;
    cat_id: string;
    name: string;
    postable: boolean;
    filterable: boolean;
    is_highlight: boolean;
    orderable: boolean;
    is_filter: boolean;
    url: string;
    query: {
        cat_id: string;
        sub_cat_id: string;
    };
}

export interface ReplyRemark {
    is_not_push_post?: boolean;
}

export interface Post {
    post_id: string;
    thread_id: string;
    msg_num: number;
    user_nickname: string;
    user_gender: string;
    status: number;
    reply_time: number;
    like_count: number;
    dislike_count: number;
    vote_score: number;
    quote_post_id: string;
    no_of_quote: number;
    remark: any[] | ReplyRemark;
    msg: string; // This is the HTML string
    is_minimized_keywords: boolean;
    page: number;
    user: User;
    display_vote: boolean;
    low_quality: boolean;
}

export interface ThreadData {
    _id: ObjectId;
    thread_id: string;
    cat_id: number;
    sub_cat_id: number;
    title: string;
    user_id: string;
    user_nickname: string;
    user_gender: string;
    no_of_reply: number;
    no_of_uni_user_reply: number;
    like_count: number;
    dislike_count: number;
    reply_like_count: number;
    reply_dislike_count: number;
    max_reply_like_count: number;
    max_reply_dislike_count: number;
    create_time: number;
    last_reply_time: number;
    status: number;
    remark: {
        last_reply_count: number;
        no_of_uni_not_push_post: number;
    };
    last_reply_user_id: number;
    is_adu: boolean;
    max_reply: number;
    parent_thread_id: null;
    first_post_id: string;
    total_page: number;
    is_hot: boolean;
    category: Category;
    sub_category?: SubCategory;
    is_highlight_sub_cat: boolean;
    display_vote: true;
    vote_status: "0";
    is_bookmarked: false;
    is_replied: false;
    user: User;
    allow_create_child_thread: false;
    page: "1";
    item_data: Post[];
}