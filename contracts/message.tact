message LogEventMintRecord {
    minter: Address;
    item_id: Int;
    generate_number: Int;
}


message(0x693d3950) GetRoyaltyParams {
    query_id: Int as uint64;
}

message GetProfile {
    query_id: Int as uint64;
}

message(0xa8cb00ad) ReportRoyaltyParams {
    query_id: Int as uint64;
    numerator: Int as uint16;
    denominator: Int as uint16;
    destination: Address;
}

struct CollectionData {
    next_item_index: Int;
    collection_content: Cell;
    owner_address: Address;
}
struct RoyaltyParams {
    numerator: Int;
    denominator: Int;
    destination: Address;
}
message CollectionSetupParams {
    owner_address: Address;
    master_address: Address;
    collection_content: Cell; 
    nft_individual_content_url: Cell;
    royalty_params: RoyaltyParams;
    mint_limit: Int;
    nft_price: Int;
    mint_time_limit: Int;
    is_sbt: Int;
    enable_profile: Bool;
    enable_whitelist: Bool;
    user_item_limit: Int;
}

message UpdateWhiteList {
    user: Address;
    whitelist: Bool;
}

message AddToWhiteList {
    add: Bool;
}

message CollectionMintParams {
    queryId: Int;
    owner_address: Address;
    collection_content: Cell; 
    nft_individual_content_url: Cell;
    royalty_params: RoyaltyParams;
    mint_limit: Int;
    mint_time_limit: Int;
    is_sbt: Int;
    nft_price: Int;
    enable_profile: Bool;
    enable_whitelist: Bool;
    user_item_limit: Int;
}

message ProfileData {
    query_id: Int as uint64;
    user: Address;
    is_whitelisted: Bool;
    is_blacklisted: Bool;
}

message(0x5fcc3d14) Transfer {
    query_id: Int as uint64;
    new_owner: Address;
    response_destination: Address?;
    custom_payload: Cell?;
    forward_amount: Int as coins;
    forward_payload: Slice as remaining;
}

message(0x05138d91) OwnershipAssigned {
    query_id: Int as uint64;
    prev_owner: Address;
    forward_payload: Slice as remaining;
}
message(0xd53276db) Excesses {
    query_id: Int as uint64;
}
message(0x2fcb26a2) GetStaticData {
    query_id: Int as uint64;
}
message(0x8b771735) ReportStaticData {
    query_id: Int as uint64;
    index_id: Int;
    collection: Address;
}
struct GetNftData {
    is_initialized: Bool;
    index: Int;
    collection_address: Address;
    owner_address: Address;
    individual_content: Cell;
}

struct CollectionMasterData {
    master: Address;
    mint_limit: Int;
    price: Int;
    mint_time_limit: Int;
    is_sbt: Int;
    index_in_collection: Int;
}

struct CollectionMasterDataV2 {
    master: Address;
    mint_limit: Int;
    price: Int;
    mint_time_limit: Int;
    is_sbt: Int;
    index_in_collection: Int;
    enable_whitelist: Bool;
    user_item_limit: Int;
}

/* 

            master: self.master_address,
            mint_limit: self.mint_limit,
            mint_time_limit: self.mint_time_limit,
            is_sbt: self.is_sbt,
            price: self.price,
            index_in_collection: self.collection_index
*/

message MintTo{
    owner: Address;
}

message MassUpdateWhiteList {
    addresses: Cell;
    add: Bool;
    spendPerAddress: Int as uint64;
}

message SetupCollectionData{
    collection_owner: Address?;
    collection_item_price: Int;
    user_item_limit: Int;
    enable_whitelist: Bool;
}

message CompleteTodo{
    seqno: Int as uint256;
}

message InternalComplete{
    excess: Address;
}


message InternalAdd{
    amount: Int as coins;
    origin: Address;
}

message TransferOwner {
    new_owner: Address;
}

message Withdraw {
    to: Address;
}

struct MasterData {
    master: Address;
    next_collection_index: Int;
    collection_creation_price: Int;
}

const masterMinStorage: Int = ton("0.05");
const minTonsForStorage: Int = ton("0.005");
const gasConsumption: Int = ton("0.012");
