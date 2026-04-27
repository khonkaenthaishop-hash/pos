import { Module, Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const CARRIERS = {
  seven_eleven: { key:'seven_eleven', name:{th:'7-Eleven',zh:'統一超商',en:'7-Eleven'}, emoji:'🟠', tracking_url:'https://eservice.7-11.com.tw/e-tracking/search.aspx', map_url:'https://emap.pcsc.com.tw/emap.aspx', has_cold:true, has_map:true, delivery_days:'3-5 วัน', rates:{normal:{price:70,cod_limit:20000},cold:{price:150,cod_limit:20000}} },
  family_mart:  { key:'family_mart',  name:{th:'Family Mart',zh:'全家便利商店',en:'FamilyMart'}, emoji:'🟢', tracking_url:'https://fmec.famiport.com.tw/FP_Entrance/QueryBox?orderno=', map_url:'https://www.family.com.tw/Marketing/th/Map', has_cold:true, has_map:true, delivery_days:'3-5 วัน', rates:{normal:{price:80,cod_limit:5000},cold:{price:150,cod_limit:5000}} },
  ok_mart:      { key:'ok_mart',      name:{th:'OK Mart',zh:'OK超商',en:'OK Mart'}, emoji:'🔴', tracking_url:'https://ecservice.okmart.com.tw/Tracking/Search', map_url:'https://www.okmart.com.tw/convenient_shopSearch_express', has_cold:true, has_map:true, delivery_days:'3-5 วัน', rates:{normal:{price:70,cod_limit:5000},cold:{price:150,cod_limit:5000}} },
  hilife:       { key:'hilife',       name:{th:'Hi-Life',zh:'萊爾富',en:'Hi-Life'}, emoji:'🔵', tracking_url:'https://www.hilife.com.tw/serviceInfo_search.aspx', map_url:null, has_cold:false, has_map:false, delivery_days:'-', rates:{normal:{price:70,cod_available:false}} },
  black_cat:    { key:'black_cat',    name:{th:'แมวดำ',zh:'黑貓宅急便',en:'T-CAT'}, emoji:'🐱', tracking_url:'https://www.t-cat.com.tw/Inquire/Trace.aspx', map_url:null, has_cold:true, has_map:false, delivery_days:'1 วัน', rates:{normal:{small:130,medium:170,large_min:210,large_max:250},cold:{small:160,medium:225,large_min:290,large_max:350}} },
  post:         { key:'post',         name:{th:'ไปรษณีย์',zh:'中華郵政',en:'Taiwan Post'}, emoji:'📮', tracking_url:'https://postserv.post.gov.tw/pstmail/main_mail.html?targetTxn=', map_url:null, has_cold:false, has_map:false, delivery_days:'-', rates:{normal:{small:100,medium:150,large:200,cod_extra:30}} },
};

@ApiTags('Carriers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('carriers')
export class CarriersController {
  @Get() findAll() { return Object.values(CARRIERS); }
  @Get(':key') findOne(@Param('key') key: string) { return CARRIERS[key] || null; }
}

@Module({ controllers: [CarriersController] })
export class CarriersModule {}
