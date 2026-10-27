import {getStore} from '@netlify/blobs';
import {makeHandler} from './lib/core.mjs';
import privateConfig from './private-config.json' with {type:'json'};
export default async function(req){return makeHandler({store:getStore({name:'arthus-members-v1',consistency:'strong'}),env:process.env,privateConfig})(req)}
