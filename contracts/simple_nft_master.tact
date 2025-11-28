import "@stdlib/deploy";
import "./simple_nft_collection_v2";
import "./message.tact";

contract SimpleNftMaster with Deployable {

    /* 
      Root contract of SimpleNFT project
      Powered by Vorpal team
      https://github.com/VORPALTEAM
      
      Code by Yuriy Berland
      https://github.com/YuriyBum
    */
    
    owner: Address;
    next_collection_index: Int = 0;
    collection_creation_price: Int as uint32 = 0;

    init(
        owner: Address,
        creation_price: Int,
    ) {
        self.owner = owner;
        self.collection_creation_price = creation_price;
    }

    receive(msg: CollectionMintParams) {
        require(self.next_collection_index >= 0, "non-sequential Collections");
        let ctx: Context = context();
        require(ctx.value >= self.collection_creation_price, "Creation underpriced");
        let minPriceRequired = msg.enable_profile ? nftBalanceConst : minPriceNoProfile;
        require(msg.nft_price >= minPriceRequired, "Token price too low");
        if (msg.mint_time_limit > 0) {
            require(msg.mint_time_limit > now(), "Collection must have time to mint");
        }
        let collection_init: StateInit = self.getCollectionItemInit(self.next_collection_index);
        
        send(SendParameters{
                to: contractAddress(collection_init), 
                value: masterMinStorage, 
                bounce: false,
                mode: SendIgnoreErrors,
                body: CollectionSetupParams {
                    owner_address: msg.owner_address,
                    master_address: myAddress(),
                    collection_content: msg.collection_content,
                    nft_individual_content_url: msg.nft_individual_content_url,
                    royalty_params: msg.royalty_params,
                    mint_limit: msg.mint_limit,
                    nft_price: msg.nft_price,
                    mint_time_limit: msg.mint_time_limit,
                    is_sbt: msg.is_sbt,
                    enable_whitelist: msg.enable_whitelist,
                    enable_profile: msg.enable_profile,
                    user_item_limit: msg.user_item_limit
                }.toCell(),
                code: collection_init.code,
                data: collection_init.data
            });
        self.next_collection_index = self.next_collection_index + 1;
    }

    receive(msg: Withdraw) {
        require(sender() == self.owner, "Not from owner");
        send(SendParameters{
            to: msg.to,
            value: myBalance() - masterMinStorage,
            bounce: false,
            mode: SendIgnoreErrors
        });
    }

    receive(msg: TransferOwner) {
        require(sender() == self.owner, "Not from owner");
        self.owner = msg.new_owner;
    }

    receive() {}

    get fun getCollectionItemInit(item_index: Int): StateInit {
        return initOf SimpleNftCollectionV2(myAddress(), item_index);
    }

    get fun get_master_data (): MasterData {
        return MasterData{
            master: self.owner,
            next_collection_index: self.next_collection_index,
            collection_creation_price: self.collection_creation_price
        }
    }

    get fun get_collection_address_by_index (collection_index: Int): Address? {
        let initCode: StateInit = self.getCollectionItemInit(collection_index);
        return contractAddress(initCode);
    }

    get fun get_next_collection_index (): Int {
        return self.next_collection_index;
    }

}
