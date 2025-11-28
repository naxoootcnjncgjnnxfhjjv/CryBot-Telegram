import "@stdlib/deploy";
import "./message.tact";
import "./nft_item.tact";
import "./sbt_item.tact";
import "./buyer_profile.tact";

const nftBalanceConst: Int = ton("0.05");
const minPriceNoProfile: Int = ton("0.039");
const whitelistUpdatePrice: Int = ton("0.009");
const massUpdateMasterFee: Int = ton("0.01");
const singleTransactionReserve: Int = ton("0.005");


contract SimpleNftCollectionV2 with Deployable {

    next_item_index: Int as uint32 = 0;
    collection_index: Int as uint32 = 0;
    owner_address: Address?;
    master_address: Address;
    royalty_params: RoyaltyParams?;                      
    collection_content: Cell?;   
    individual_content_url: Cell?;
    mint_limit: Int as uint32 = 0;
    price: Int = 0;
    is_setup: Bool;
    is_sbt: Int = 0;
    mint_time_limit: Int as uint32 = 0;
    enable_profile: Bool = false;
    user_item_limit: Int as uint8 = 0;
    enable_whitelist: Bool = false;

    init(
    master_address: Address,
    collection_index: Int){
        require(sender() == master_address, "Not from master");
        self.collection_index = collection_index;
        self.master_address = master_address;
        self.is_setup = false;
    }

    receive(msg: CollectionSetupParams) {
        require(sender() == self.master_address, "Not from master");
        require(self.is_setup == false, "Collection settings is already setup");
        self.price = msg.nft_price;
        self.mint_limit = msg.mint_limit;
        self.owner_address = msg.owner_address; // msg.owner_address;
        self.royalty_params = msg.royalty_params;
        self.collection_content = msg.collection_content;
        self.individual_content_url = msg.nft_individual_content_url;
        self.is_setup = true;
        self.is_sbt = msg.is_sbt;
        self.enable_profile = msg.enable_profile;
        self.user_item_limit = msg.user_item_limit;
        self.mint_time_limit = msg.mint_time_limit;
        self.enable_whitelist = msg.enable_whitelist;
    }
    // Profile
    get fun buyer_profile_address(owner: Address): Address{
        return contractAddress(initOf BuyerProfile(myAddress(), owner));
    }

    receive("RequestWhitelist") {
         require(self.enable_profile == true, "Profile not nessesary for this collection");
         let init: StateInit = initOf BuyerProfile(myAddress(), sender());
         send(SendParameters{
            to: contractAddress(init),
            body: SetupCollectionData{
                collection_owner: self.owner_address,
                collection_item_price: self.price,
                enable_whitelist: self.enable_whitelist,
                user_item_limit: self.user_item_limit
            }.toCell(),
            value: ton("0.02"),
            mode: SendIgnoreErrors,
            code: init.code,
            data: init.data
        });       
    }
    
    // Classic for a free mint
    receive("Mint"){
        let ctx: Context = context(); // get sender Info
        require(ctx.value >= self.price, "NFT creation underpriced");
        require(self.enable_profile == false, "Another method for profiles");
        let msgValue: Int = ctx.value;
        let tonBalanceBeforeMsg: Int = myBalance() - msgValue;
        let storageFee: Int = minTonsForStorage - min(tonBalanceBeforeMsg, minTonsForStorage);
        msgValue = msgValue - (storageFee + gasConsumption);
        
        self.mint(ctx.sender, msgValue);

        emit(LogEventMintRecord{ minter: sender(), item_id: self.next_item_index, generate_number: nativeRandom() }.toCell());
    }

    receive(msg: Withdraw) {
        require(sender() == self.owner_address, "Not from owner");
        send(SendParameters{
            to: msg.to,
            value: myBalance() - masterMinStorage,
            bounce: false,
            mode: SendIgnoreErrors
        });
    }

    // Mint with whitelist support
    receive(msg: MintTo) {
        let ownerProfile = self.get_user_profile_init(msg.owner);
        require(sender() == contractAddress(ownerProfile), "From profile only");
        let ctx: Context = context();
        let msgValue: Int = ctx.value;
        let tonBalanceBeforeMsg: Int = myBalance() - msgValue;
        let storageFee: Int = minTonsForStorage - min(tonBalanceBeforeMsg, minTonsForStorage);
        msgValue = msgValue - (storageFee + gasConsumption);
        
        self.mint(msg.owner, msgValue);
    }

    // ===== Private Methods ===== //

    fun mint(sender: Address, msgValue: Int) {
        require(self.next_item_index >= 0, "non-sequential NFTs");
        require(self.is_setup == true, "Collection settings is not setup");
        if (self.mint_limit > 0) {
            require(self.next_item_index <= self.mint_limit, "Mint limit reached");
        }
        if (self.mint_time_limit > 0) {
            require(now() <= self.mint_time_limit, "Mint time limit reached");
        }
        let nft_init: StateInit = self.getNftItemInit(self.next_item_index);
        let noFeeConst = self.enable_profile ? nftBalanceConst : minPriceNoProfile;
        let feeValue = msgValue  > noFeeConst ? msgValue - noFeeConst : 0;
        send(SendParameters{
                to: contractAddress(nft_init), 
                value: msgValue - feeValue, 
                bounce: false,
                mode: SendIgnoreErrors,
                body: Transfer {
                    query_id: 0,
                    new_owner: sender,
                    response_destination: self.owner_address,
                    custom_payload: self.individual_content_url,
                    forward_amount: 0,
                    forward_payload: emptySlice()
                }.toCell(),
                code: nft_init.code,
                data: nft_init.data
            });
        if (feeValue > 0) {
          send(SendParameters{
            to: self.master_address,
            value: (feeValue * 3) / 100,
            bounce: false,
            mode: SendIgnoreErrors 
          });

        // let balanceRemaining: Int = myBalance();
          send(SendParameters{
            to: self.owner_address!!,
            value: (feeValue * 97) / 100, // (feeValue * 97) / 100,
            bounce: false,
            mode: SendIgnoreErrors 
          });
        } 
        
        dump(self.next_item_index); // Reference at: https://tact-by-example.org/03-emit
        self.next_item_index = self.next_item_index + 1;
    }

    // -------------- Profile operations ----------------------- //
    get fun get_buyer_profile_address (address: Address): Address {
      let profile = self.get_user_profile_init(address);
      return contractAddress(profile);
    }

    fun update_white_list(address: Address, add: Bool, value: Int) {
      let profile = self.get_user_profile_init(address);
      send(SendParameters{
        to: contractAddress(profile),
        body: AddToWhiteList {
            add: add
        }.toCell(),
        value: value,
        mode: SendIgnoreErrors
      });  
    }

    receive(msg: GetRoyaltyParams) {   
        let ctx: Context = context(); // get sender Info
        send(SendParameters{
            to: ctx.sender,
            value: 0,
            mode: 64, 
            bounce: false,
            body: ReportRoyaltyParams {
                query_id: msg.query_id,
                numerator:  (self.royalty_params!!).numerator,
                denominator: (self.royalty_params!!).denominator,
                destination: (self.royalty_params!!).destination
            }.toCell()
        });        
    }

    receive(msg: UpdateWhiteList) {
        require(sender() == self.owner_address, "Not a collection owner");
        let ctx: Context = context();
        self.update_white_list(msg.user, msg.whitelist, whitelistUpdatePrice); // ctx.value - singleTransactionReserve
    }

    receive(msg: MassUpdateWhiteList) {
    require(sender() == self.owner_address, "Not a collection owner");
    let cell = msg.addresses;
    let slice = cell.beginParse();

      while (true) {
         let address = slice.loadAddress();
         self.update_white_list(address, msg.add, msg.spendPerAddress);

         if (slice.refs() > 0) {
           slice = slice.loadRef().beginParse();
         } else {
           return;
        }
      }  
      
      send(SendParameters{
           to: self.master_address,
           value: massUpdateMasterFee,
           bounce: false,
           mode: SendIgnoreErrors 
        });
    }

    get fun get_master_data_v2(): CollectionMasterDataV2 {
        return CollectionMasterDataV2{
            master: self.master_address,
            mint_limit: self.mint_limit,
            mint_time_limit: self.mint_time_limit,
            is_sbt: self.is_sbt,
            price: self.price,
            enable_whitelist: self.enable_whitelist,
            index_in_collection: self.collection_index,
            user_item_limit: self.user_item_limit
        }
    }

    get fun get_master_data(): CollectionMasterData {
        return CollectionMasterData{
            master: self.master_address,
            mint_limit: self.mint_limit,
            mint_time_limit: self.mint_time_limit,
            is_sbt: self.is_sbt,
            price: self.price,
            index_in_collection: self.collection_index
        }
    }

    // ------------------ Get Function  ------------------ //
    get fun get_collection_data(): CollectionData {     
        let b: StringBuilder = beginString();
        let collectionDataString: String = (self.collection_content!!).asSlice().asString();
        b.append(collectionDataString);
        return CollectionData{
            next_item_index: self.next_item_index, 
            collection_content: b.toCell(), 
            owner_address: self.owner_address!!
        };
    }

    get fun get_nft_address_by_index(item_index: Int): Address?{      
        let initCode: StateInit = self.getNftItemInit(item_index);
        return contractAddress(initCode);
    }

    get fun getNftItemInit(item_index: Int): StateInit {
        // return initOf NftItem(myAddress(), item_index);
        if (self.is_sbt == 0) {
            return initOf NftItem(myAddress(), item_index);
        } else 
            return initOf SbtItem(myAddress(), item_index);
        }
    }

    get fun get_user_profile_init(address: Address): StateInit {
        return initOf BuyerProfile(myAddress(), address);
    }
    
    get fun get_nft_content(index: Int, individual_content: Cell): Cell { 
        let b: StringBuilder = beginString();
        let ic: String = individual_content.asSlice().asString();
        b.append(ic);
        return b.toCell();
    }

    get fun get_sample_nft_content (): Cell? {
        let b: StringBuilder = beginString();
        let ic: String = (self.individual_content_url!!).asSlice().asString();
        b.append(ic);
        return b.toCell();
    }

    get fun royalty_params(): RoyaltyParams {
        return self.royalty_params!!;
    }
}
