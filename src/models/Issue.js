import mongoose from 'mongoose';
import validator from 'validator';
import bcrypt from 'bcrypt';
import fs from 'fs';

var Schema = mongoose.Schema;
var issueSchema = new Schema({
	id: {type: Number, default: undefined},
	repo: {type: Schema.Types.ObjectId, ref: 'Repo'},
	createdBy: {type: Schema.Types.ObjectId, ref: 'User'},
	replies: [{type: Schema.Types.ObjectId, ref: 'IssueReply'}],
	labels: [{type: Schema.Types.ObjectId, ref: 'IssueLabel'}],
	participants: [{type: Schema.Types.ObjectId, ref: 'User'}],
	title: {
		type: String,
		required: [true, 'name is required'],
		minlength: 1
	},
	description: {
		type: String,
		required: [true, 'name is required'],
		minlength: 1
	},
});

issueSchema.pre('save', function(next) {
	if(this.id == undefined){
	    var doc = this;
	    mongoose
	    	.model('Issue')
	    	.find({
	    		repo: this.repo
	    	})
	    	.sort('-id')
	    	.limit(1)
	    	.exec((err, repos) => {
	    		this.id = repos.length == 0 ? 1 : parseInt(repos[0].id) + 1;
	    		next();
	    	});
	}else{
		next();
	}
});

var Issue = mongoose.model('Issue', issueSchema);

export default Issue;